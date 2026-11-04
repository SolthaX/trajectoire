"""Synchronise trajectoire.json avec un calendrier iCloud (CalDAV).

Lancé par .github/workflows/calendrier.yml à chaque synchro de l'app. Ce qui est envoyé :
- événements de networking (sauf annulés et « pas allé ») ;
- entretiens (sauf annulés) ;
- relances (journée entière, à la date de relance du contact) ;
- messages et calls prévus.

Le script ne touche qu'au calendrier dédié (CALENDRIER_NOM, créé s'il manque), et seulement aux
éléments dont l'UID commence par « trajectoire- » : il crée, met à jour et supprime pour refléter les
données. Les heures sont « flottantes » (sans fuseau), comme dans l'app et l'export .ics.

Variables : ICLOUD_USER (Apple ID), ICLOUD_APP_PASSWORD (mot de passe d'application),
CALENDRIER_NOM (défaut « Trajectoire »), CALDAV_URL (défaut iCloud), DONNEES (défaut trajectoire.json).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

UID_PREFIX = "trajectoire-"
UID_DOMAIN = "solthax.github.io"

EVENT_KINDS = {
    "afterwork": "Afterwork / apéro",
    "conference": "Conférence / table ronde",
    "atelier": "Atelier",
    "forum": "Forum / salon",
    "petit_dejeuner": "Petit déjeuner",
    "diner": "Déjeuner / dîner",
    "webinaire": "Webinaire",
    "autre": "Autre",
}
INTERVIEW_KINDS = {
    "rh": "RH",
    "manager": "Manager",
    "technique": "Technique / cas",
    "equipe": "Équipe",
    "final": "Final / direction",
    "autre": "Autre",
}
INTERVIEW_FORMATS = {"visio": "Visio", "telephone": "Téléphone", "sur_site": "Sur site"}
INTERACTION_TYPES = {
    "email": "Email",
    "appel": "Appel",
    "linkedin": "LinkedIn",
    "whatsapp": "WhatsApp",
    "sms": "SMS",
    "rdv": "Rendez-vous",
    "candidature": "Candidature",
    "note": "Note",
}
CLOSED_CONTACT_STATUSES = {"sans_suite"}


# --- iCalendar -----------------------------------------------------------------------
def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")


def fold(line: str) -> str:
    """Replie à 75 octets (RFC 5545) sans couper un caractère UTF-8."""
    out, cur, n = [], "", 0
    for ch in line:
        b = len(ch.encode())
        if n + b > (74 if out else 75):
            out.append(cur)
            cur, n = "", 0
        cur += ch
        n += b
    out.append(cur)
    return "\r\n ".join(out)


def parse_local(s: str) -> datetime | date | None:
    """« 2026-11-04T19:00 » → datetime ; « 2026-11-04 » → date."""
    s = (s or "").strip()
    try:
        if len(s) > 10:
            return datetime.fromisoformat(s[:19])
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def fmt(v: datetime | date) -> str:
    return v.strftime("%Y%m%dT%H%M%S") if isinstance(v, datetime) else v.strftime("%Y%m%d")


def vevent(uid: str, start: datetime | date, end: datetime | date | None, summary: str, *, location="", url="",
           description="", status="CONFIRMED", minutes=60) -> list[str]:
    if isinstance(start, datetime):
        if not isinstance(end, datetime) or end <= start:
            end = start + timedelta(minutes=minutes)
        dates = [f"DTSTART:{fmt(start)}", f"DTEND:{fmt(end)}"]
    else:
        dates = [f"DTSTART;VALUE=DATE:{fmt(start)}", f"DTEND;VALUE=DATE:{fmt(start + timedelta(days=1))}"]
    body = [
        f"UID:{uid}",
        *dates,
        f"SUMMARY:{esc(summary)}",
        location and f"LOCATION:{esc(location)}",
        url and f"URL:{url}",
        description and f"DESCRIPTION:{esc(description)}",
        f"STATUS:{status}",
    ]
    body = [l for l in body if l]
    # Empreinte du contenu : permet de ne réécrire que ce qui a changé.
    digest = hashlib.sha256("\n".join(body).encode()).hexdigest()[:16]
    return ["BEGIN:VEVENT", *body, f"X-TRAJECTOIRE-HASH:{digest}", f"DTSTAMP:{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}",
            "END:VEVENT"], digest


def calendar(lines: list[str]) -> str:
    out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trajectoire//Calendrier//FR", "CALSCALE:GREGORIAN", *lines, "END:VCALENDAR"]
    return "\r\n".join(fold(l) for l in out) + "\r\n"


# --- données → événements ------------------------------------------------------------
def full_name(c: dict) -> str:
    return " ".join(x for x in (c.get("first_name"), c.get("last_name")) if x) or "Contact"


def ensure_url(u: str) -> str:
    u = (u or "").strip()
    if not u:
        return ""
    return u if re.match(r"^[a-z][a-z0-9+.-]*:", u, re.I) else f"https://{u}"


def build(data: dict) -> dict[str, tuple[str, str]]:
    """UID → (VCALENDAR, empreinte)."""
    t = data.get("tables", {})
    companies = {c["id"]: c for c in t.get("companies", [])}
    contacts = {c["id"]: c for c in t.get("contacts", [])}
    jobs = {j["id"]: j for j in t.get("jobs", [])}
    co_name = lambda cid: (companies.get(cid) or {}).get("name", "")
    out: dict[str, tuple[str, str]] = {}

    def add(kind: str, rid, start, *args, **kw):
        if start is None:
            return
        uid = f"{UID_PREFIX}{kind}-{rid}@{UID_DOMAIN}"
        lines, digest = vevent(uid, start, *args, **kw)
        out[uid] = (calendar(lines), digest)

    for ev in t.get("events", []):
        if ev.get("status") in ("annule", "pas_alle"):
            continue
        repere = ev.get("status") == "repere"
        desc = "\n".join(x for x in (
            co_name(ev.get("organizer_id")) and f"Organisateur : {co_name(ev.get('organizer_id'))}",
            EVENT_KINDS.get(ev.get("kind"), ""),
            "Inscription à faire" if repere else "",
            ev.get("link") and f"Visio : {ev['link']}",
            ev.get("url") and f"Page de l'événement : {ev['url']}",
            ev.get("preparation") and f"Préparation :\n{ev['preparation']}",
        ) if x)
        add("event", ev["id"], parse_local(ev.get("starts_at")), parse_local(ev.get("ends_at") or ""),
            f"{ev.get('name', 'Événement')}{' (repéré)' if repere else ''}",
            location=ev.get("place", ""), url=ensure_url(ev.get("url") or ev.get("link") or ""), description=desc,
            status="TENTATIVE" if repere else "CONFIRMED", minutes=120)

    for iv in t.get("interviews", []):
        if iv.get("status") == "annule":
            continue
        job = jobs.get(iv.get("job_id")) or {}
        company = co_name(iv.get("company_id")) or co_name(job.get("company_id"))
        what = company or job.get("title") or ""
        place = iv.get("place", "")
        is_link = bool(re.match(r"^(https?://|www\.)", place))
        desc = "\n".join(x for x in (
            job.get("title") and company and f"Poste : {job['title']}",
            INTERVIEW_FORMATS.get(iv.get("format"), ""),
            iv.get("interviewers") and f"Avec : {iv['interviewers']}",
            iv.get("preparation") and f"Préparation :\n{iv['preparation']}",
        ) if x)
        add("interview", iv["id"], parse_local(iv.get("scheduled_at")), None,
            f"Entretien {INTERVIEW_KINDS.get(iv.get('kind'), '')}{' · ' + what if what else ''}".replace("  ", " "),
            location="" if is_link else place, url=ensure_url(place) if is_link else "", description=desc,
            minutes=int(iv.get("duration") or 60))

    for c in t.get("contacts", []):
        if not c.get("next_followup") or c.get("status") in CLOSED_CONTACT_STATUSES:
            continue
        d = parse_local(c["next_followup"][:10])
        company = co_name(c.get("company_id"))
        add("followup", c["id"], d, None, f"Relancer {full_name(c)}{' · ' + company if company else ''}",
            description=c.get("role", ""))

    for it in t.get("interactions", []):
        if it.get("direction") != "prevu":
            continue
        who = full_name(contacts[it["contact_id"]]) if it.get("contact_id") in contacts else co_name(it.get("company_id"))
        title = " · ".join(x for x in (INTERACTION_TYPES.get(it.get("type"), "Action"), who, it.get("subject", "")) if x)
        add("planned", it["id"], parse_local(it.get("date")), None, title, url=ensure_url(it.get("link", "")),
            description=it.get("content", ""), minutes=30)

    return out


# --- CalDAV --------------------------------------------------------------------------
def main() -> int:
    user = os.environ.get("ICLOUD_USER", "").strip()
    password = os.environ.get("ICLOUD_APP_PASSWORD", "").strip()
    if not user or not password:
        print("::notice::Secrets ICLOUD_USER / ICLOUD_APP_PASSWORD absents : synchro du calendrier ignorée.")
        return 0
    source = Path(os.environ.get("DONNEES", "trajectoire.json"))
    if not source.exists():
        print(f"::notice::{source} absent : rien à synchroniser.")
        return 0
    wanted = build(json.loads(source.read_text(encoding="utf-8")))

    import caldav  # installé par le workflow

    name = os.environ.get("CALENDRIER_NOM", "").strip() or "Trajectoire"
    url = os.environ.get("CALDAV_URL", "").strip() or "https://caldav.icloud.com/"
    with caldav.DAVClient(url=url, username=user, password=password) as client:
        principal = client.principal()
        cal = next((c for c in principal.calendars() if (c.get_display_name() or "") == name), None)
        if cal is None:
            cal = principal.make_calendar(name=name)
            print(f"Calendrier « {name} » créé.")

        existing: dict[str, tuple[object, str]] = {}
        for obj in cal.events():
            raw = obj.data or ""
            m = re.search(r"^UID:(.+?)\r?$", raw, re.M)
            if not m or not m.group(1).startswith(UID_PREFIX):
                continue  # pas à nous : on n'y touche pas
            h = re.search(r"^X-TRAJECTOIRE-HASH:(\w+)", raw, re.M)
            existing[m.group(1).strip()] = (obj, h.group(1) if h else "")

        created = updated = deleted = 0
        for uid, (ics, digest) in wanted.items():
            if uid in existing:
                obj, old = existing[uid]
                if old == digest:
                    continue
                obj.data = ics
                obj.save()
                updated += 1
            else:
                cal.save_event(ics)
                created += 1
        for uid, (obj, _) in existing.items():
            if uid not in wanted:
                obj.delete()
                deleted += 1

    print(f"Calendrier « {name} » : {len(wanted)} élément(s) ; {created} créé(s), {updated} mis à jour, {deleted} supprimé(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
