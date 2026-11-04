import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Copy, Download, ExternalLink, Plus, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Criterion } from '../../../shared/types';
import { installCalendarWorkflow, lastCalendarRun, runCalendarNow } from '../../backend/calendarSync';
import { syncNow, useSyncStatus } from '../../backend/sync';
import { Button, IconButton } from '../../components/ui/button';
import { Field, FormGrid, Input, Segmented, Textarea } from '../../components/ui/form';
import { useConfirm } from '../../components/ui/overlay';
import { Card, CardHeader, PageHeader } from '../../components/ui/misc';
import { api, errorMessage, refreshAll, useList, useRemove, useSave, useSaveSettings, useSettings } from '../../lib/api';
import { useFormState } from '../../lib/form';
import { fmtAgo } from '../../lib/format';
import { checkRepo, setConfig, useGithubConfig } from '../../lib/github';
import { isStandalone } from '../../lib/pwa';
import { PhoneCard } from './PhoneCard';
import { openInZen, setZenLinks, useZenLinks } from '../../lib/zen';

function ProfileCard() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const { values, bind, reset } = useFormState({ first_name: '', last_name: '', email: '', phone: '', linkedin: '', signature: '' });
  const [days, setDays] = useState('7');
  useEffect(() => {
    if (data) {
      reset(data.profile);
      setDays(String(data.followup_days));
    }
  }, [data, reset]);
  const submit = async () => {
    try {
      await save.mutateAsync({ profile: values, followup_days: Math.max(1, Number(days) || 7) });
      toast.success('Profil enregistré');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <CardHeader title="Mon profil" subtitle="Utilisé pour remplir les variables {{mon_prenom}}, {{signature}}… des mails et lettres." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <FormGrid>
          <Field label="Prénom">{(id) => <Input id={id} {...bind('first_name')} />}</Field>
          <Field label="Nom">{(id) => <Input id={id} {...bind('last_name')} />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" {...bind('email')} />}</Field>
          <Field label="Téléphone">{(id) => <Input id={id} {...bind('phone')} />}</Field>
          <Field label="LinkedIn" className="sm:col-span-2">
            {(id) => <Input id={id} {...bind('linkedin')} placeholder="https://www.linkedin.com/in/…" />}
          </Field>
        </FormGrid>
        <Field label="Signature" hint="Laissez vide pour utiliser « Prénom Nom, téléphone, email ».">
          {(id) => <Textarea id={id} {...bind('signature')} rows={4} />}
        </Field>
        <Field label="Délai de relance par défaut (jours)" hint="Proposé après chaque envoi de mail ou échange sortant." className="max-w-[260px]">
          {(id) => <Input id={id} type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}

function LatexEngineCard() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const engine = data?.latex_engine ?? 'github';
  const choose = async (v: 'github' | 'rapide') => {
    try {
      await save.mutateAsync({ latex_engine: v });
      toast.success(v === 'rapide' ? 'Compilation rapide activée' : 'Compilation par GitHub Actions');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <CardHeader title="Compilation LaTeX" subtitle="Comment le bouton « Compiler » des documents LaTeX produit le PDF." />
      <div className="space-y-3">
        <Segmented
          value={engine}
          onChange={(v) => void choose(v)}
          options={[
            { value: 'github', label: 'GitHub Actions (≈ 1 min)' },
            { value: 'rapide', label: 'Rapide (≈ 2 s)' },
          ]}
        />
        {engine === 'github' ? (
          <p className="text-[12.5px] text-ink-3">
            Le document est compilé dans votre dépôt privé par GitHub Actions. Rien ne sort de GitHub, mais il faut compter environ une minute.
          </p>
        ) : (
          <p className="text-[12.5px] text-warning-ink">
            Le .tex et les fichiers de son dossier (images, .cls, .bib…) sont envoyés à chaque compilation au service public{' '}
            <span className="font-mono">latex.ytotech.com</span> (connexion chiffrée, sans engagement formel de confidentialité). Le PDF est
            ensuite enregistré dans votre dépôt privé, comme avec GitHub.
          </p>
        )}
      </div>
    </Card>
  );
}

function ZenLinksCard() {
  const on = useZenLinks();
  return (
    <Card>
      <CardHeader title="Liens externes" subtitle="Navigateur qui ouvre les liens (sites, LinkedIn, offres, visio…) depuis l'app installée." />
      <div className="space-y-3">
        <Segmented
          value={on ? 'zen' : 'chrome'}
          onChange={(v) => setZenLinks(v === 'zen')}
          options={[
            { value: 'chrome', label: 'Chrome' },
            { value: 'zen', label: 'Zen' },
          ]}
        />
        <p className="text-[12.5px] text-ink-3">
          Réglage propre à cet appareil, appliqué seulement dans l'app installée. Zen demande d'avoir lancé une fois{' '}
          <span className="font-mono">scripts/windows/installer-liens-zen.ps1</span> sous Windows. Au premier lien, Chrome demande « Ouvrir
          Zen ? » : cochez « Toujours autoriser ». Les PDF des documents restent dans Chrome.
        </p>
        {on && (
          <div className="flex items-center justify-between gap-3">
            {!isStandalone() && <p className="text-[12.5px] text-warning-ink">Vous êtes dans un onglet : les liens restent ici.</p>}
            <Button size="sm" className="ml-auto" onClick={() => openInZen('https://solthax.github.io/trajectoire/')}>
              Tester
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function CopyName({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(value).then(() => toast.success(`« ${value} » copié`))}
      className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 font-mono text-[12px] text-ink hover:bg-surface-3"
      title="Copier"
    >
      {value} <Copy className="size-3 text-ink-3" />
    </button>
  );
}

function CalendarSyncCard() {
  const cfg = useGithubConfig();
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [busy, setBusy] = useState(false);
  const on = settings?.calendar_sync ?? false;
  const run = useQuery({
    queryKey: ['calendar-run', cfg?.owner, cfg?.repo],
    queryFn: lastCalendarRun,
    enabled: !!cfg,
    refetchInterval: (q) => (q.state.data && q.state.data !== 'absent' && q.state.data.status !== 'completed' ? 5000 : false),
  });
  const r = run.data;

  const toggle = async (v: boolean) => {
    try {
      await save.mutateAsync({ calendar_sync: v });
      toast.success(v ? 'Synchro du calendrier activée' : 'Synchro du calendrier désactivée');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setTimeout(() => void run.refetch(), 4000);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const repoUrl = cfg ? `https://github.com/${cfg.owner}/${cfg.repo}` : '';
  const link = 'text-accent-ink hover:underline';

  return (
    <Card>
      <div id="calendrier" className="scroll-mt-6" />
      <CardHeader
        title="Calendrier Apple (iCloud)"
        subtitle="Vos événements de networking, entretiens, relances et messages prévus dans un calendrier « Trajectoire », sur l'iPhone et le Mac."
      />
      {!cfg ? (
        <p className="text-[12.5px] text-ink-3">Connectez d'abord la synchronisation GitHub ci-dessus : c'est GitHub Actions qui met à jour iCloud.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={on ? 'on' : 'off'}
              onChange={(v) => void toggle(v === 'on')}
              options={[
                { value: 'off', label: 'Désactivée' },
                { value: 'on', label: 'Activée' },
              ]}
            />
            <Button size="sm" icon={<RefreshCw />} disabled={busy || r === 'absent'} onClick={() => act(runCalendarNow, 'Mise à jour du calendrier lancée')}>
              Mettre à jour maintenant
            </Button>
          </div>

          <div className="text-[12.5px]">
            {run.isLoading ? (
              <span className="text-ink-3">Vérification du workflow…</span>
            ) : run.isError ? (
              <span className="text-ink-3">État inconnu : {errorMessage(run.error)}</span>
            ) : r === 'absent' ? (
              <span className="flex flex-wrap items-center gap-2 text-warning-ink">
                Le workflow n'est pas encore dans le dépôt.
                <Button size="sm" disabled={busy} onClick={() => act(installCalendarWorkflow, 'Workflow du calendrier installé')}>
                  L'installer
                </Button>
              </span>
            ) : !r ? (
              <span className="text-ink-3">Jamais lancé.</span>
            ) : (
              <a href={r.html_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                {r.status !== 'completed' ? (
                  <RefreshCw className="size-3.5 animate-spin text-ink-3" />
                ) : r.conclusion === 'success' ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <XCircle className="size-3.5 text-danger" />
                )}
                <span className={r.status === 'completed' && r.conclusion !== 'success' ? 'text-danger' : 'text-ink-2'}>
                  {r.status !== 'completed'
                    ? 'Mise à jour en cours…'
                    : r.conclusion === 'success'
                      ? `Dernière mise à jour réussie ${fmtAgo(r.created_at)}`
                      : `Dernière mise à jour en échec ${fmtAgo(r.created_at)} : voir le journal`}
                </span>
                <ExternalLink className="size-3 text-ink-3" />
              </a>
            )}
          </div>

          <details className="group rounded-lg border border-line bg-surface-2/50 px-3 py-2" open={!on}>
            <summary className="cursor-pointer text-[13px] font-medium text-ink">Mise en place (une seule fois, 5 minutes)</summary>
            <ol className="mt-2 list-decimal space-y-2.5 pl-5 text-[13px] text-ink-2">
              <li>
                <strong>Mot de passe d'application Apple.</strong> Sur{' '}
                <a href="https://account.apple.com" target="_blank" rel="noreferrer" className={link}>
                  account.apple.com
                </a>{' '}
                → Connexion et sécurité → <em>Mots de passe d'app</em> → « + », nommé par exemple « Trajectoire ». Notez le mot de passe affiché
                (format <span className="font-mono">xxxx-xxxx-xxxx-xxxx</span>) : il ne sera plus montré. Il donne accès à iCloud (calendriers,
                contacts, mails) mais pas à votre compte Apple, et se révoque au même endroit.
              </li>
              <li>
                <strong>Deux secrets dans le dépôt privé.</strong> Ouvrez{' '}
                <a href={`${repoUrl}/settings/secrets/actions/new`} target="_blank" rel="noreferrer" className={link}>
                  Settings → Secrets → New repository secret
                </a>{' '}
                et créez :
                <ul className="mt-1.5 space-y-1">
                  <li>
                    <CopyName value="ICLOUD_USER" /> : votre Apple ID (adresse e-mail) ;
                  </li>
                  <li>
                    <CopyName value="ICLOUD_APP_PASSWORD" /> : le mot de passe de l'étape 1.
                  </li>
                </ul>
                <span className="mt-1 block text-[12px] text-ink-3">Les secrets ne sont lisibles par personne, pas même par l'app : seul le workflow les utilise.</span>
              </li>
              <li>
                <strong>Droits du jeton.</strong> Le jeton GitHub de l'app doit avoir <em>Actions : Read and write</em> (c'est le cas si vous avez suivi la
                procédure de connexion). Pour installer le workflow depuis l'app, il faut aussi <em>Workflows : Read and write</em>.
              </li>
              <li>
                <strong>Activer</strong> ci-dessus, puis <em>Mettre à jour maintenant</em>. Le premier passage crée le calendrier « Trajectoire »
                dans iCloud (environ 30 secondes). L'état ci-dessus doit passer à « réussie ».
              </li>
              <li>
                <strong>Sur l'iPhone :</strong> Réglages → [votre nom] → iCloud → <em>Calendriers</em> activé. Dans l'app Calendrier → <em>Calendriers</em>,
                cochez « Trajectoire ». Sur le Mac : Calendrier → Réglages → Comptes → iCloud.
              </li>
            </ol>
          </details>

          <ul className="space-y-1 text-[12.5px] text-ink-3">
            <li>
              <CalendarDays className="mr-1 inline size-3.5" />
              Mise à jour automatique environ une minute après une modification synchronisée, seulement si un élément du calendrier a changé.
            </li>
            <li>Modifiez les éléments dans Trajectoire, pas dans Calendrier : la mise à jour suivante rétablirait la version de l'app.</li>
            <li>Vos autres calendriers et les événements ajoutés à la main dans « Trajectoire » ne sont jamais touchés.</li>
          </ul>
        </div>
      )}
    </Card>
  );
}

function CriterionRow({ c, index, count, onMove }: { c: Criterion; index: number; count: number; onMove: (dir: -1 | 1) => void }) {
  const save = useSave('criteria');
  const remove = useRemove('criteria');
  const confirm = useConfirm();
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description);
  const [weight, setWeight] = useState(String(c.weight));
  useEffect(() => {
    setName(c.name);
    setDescription(c.description);
    setWeight(String(c.weight));
  }, [c]);
  const commit = (patch: Partial<Criterion>) => save.mutate({ id: c.id, ...patch }, { onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_76px_auto] items-start gap-3 py-3">
      <div className="min-w-0 space-y-1.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== c.name && commit({ name })} aria-label="Nom du critère" className="font-medium" />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== c.description && commit({ description })}
          placeholder="Question à se poser (facultatif)"
          aria-label="Description"
          className="h-7 w-full rounded-md border border-transparent bg-transparent px-3 text-[12.5px] text-ink-2 outline-none placeholder:text-ink-3 hover:border-line focus:border-accent"
        />
      </div>
      <div className="relative">
        <Input
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => Number(weight) !== c.weight && commit({ weight: Math.max(0, Number(weight) || 0) })}
          aria-label="Poids"
          className="pr-6"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-ink-3">×</span>
      </div>
      <div className="flex items-center pt-0.5">
        <IconButton label="Monter" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp />
        </IconButton>
        <IconButton label="Descendre" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown />
        </IconButton>
        <IconButton
          label="Supprimer"
          onClick={async () => {
            if (await confirm({ title: `Supprimer le critère « ${c.name} » ?`, message: 'Les notes déjà données sur ce critère ne compteront plus.', confirmLabel: 'Supprimer', danger: true }))
              remove.mutate(c.id);
          }}
        >
          <Trash2 />
        </IconButton>
      </div>
    </div>
  );
}

function CriteriaCard() {
  const { data = [] } = useList('criteria');
  const save = useSave('criteria');
  const move = async (index: number, dir: -1 | 1) => {
    const a = data[index];
    const b = data[index + dir];
    if (!a || !b) return;
    // Positions normalisées puis échange.
    await Promise.all(data.map((c, i) => (c.position !== i ? save.mutateAsync({ id: c.id, position: i }) : null)));
    await save.mutateAsync({ id: a.id, position: index + dir });
    await save.mutateAsync({ id: b.id, position: index });
  };
  const add = () => save.mutate({ name: 'Nouveau critère', description: '', weight: 1, position: data.length });
  const total = data.reduce((s, c) => s + c.weight, 0);
  return (
    <Card>
      <CardHeader
        title="Critères de notation des projets"
        subtitle="Chaque projet est noté de 1 à 5 sur ces critères ; le score est la moyenne pondérée des critères notés."
        actions={
          <Button size="sm" icon={<Plus />} onClick={add}>
            Ajouter
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_76px_84px] gap-3 border-b border-line pb-2 text-[11.5px] font-medium text-ink-3">
        <span>Critère et question associée</span>
        <span>Poids</span>
        <span />
      </div>
      <div className="divide-y divide-line">
        {data.map((c, i) => (
          <CriterionRow key={c.id} c={c} index={i} count={data.length} onMove={(dir) => move(i, dir)} />
        ))}
      </div>
      {data.length > 0 && (
        <p className="mt-2 text-[12px] text-ink-3">
          Poids total : {total.toLocaleString('fr-FR')} · le critère le plus lourd compte pour{' '}
          {Math.round((Math.max(...data.map((c) => c.weight)) / (total || 1)) * 100)} % du score.
        </p>
      )}
    </Card>
  );
}

const TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new?name=Trajectoire&description=Synchro%20de%20Trajectoire%20(donn%C3%A9es%20et%20documents)&expires_in=none&contents=write&actions=write&metadata=read';

function GithubCard() {
  const cfg = useGithubConfig();
  const status = useSyncStatus();
  const confirm = useConfirm();
  const [owner, setOwner] = useState(cfg?.owner ?? '');
  const [repo, setRepo] = useState(cfg?.repo ?? 'trajectoire-donnees');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(!cfg);

  const connect = async () => {
    const next = { owner: owner.trim(), repo: repo.trim(), branch: 'main', token: token.trim() || cfg?.token || '' };
    if (!next.owner || !next.repo || !next.token) return toast.error('Renseignez le propriétaire, le dépôt et le jeton.');
    setBusy(true);
    try {
      const info = await checkRepo(next);
      if (!info.private) {
        toast.error('Ce dépôt est public : vos contacts et documents y seraient visibles par tous. Utilisez un dépôt privé.');
        return;
      }
      setConfig({ ...next, branch: info.default_branch || 'main' });
      setToken('');
      setEditing(false);
      await syncNow();
      toast.success(`Connecté à ${info.full_name}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: 'Déconnecter GitHub sur cet appareil ?',
      message: 'Vos données restent sur cet appareil et dans le dépôt, mais ne seront plus synchronisées. Les documents ne seront plus accessibles ici.',
      confirmLabel: 'Déconnecter',
    });
    if (ok) {
      setConfig(null);
      setEditing(true);
    }
  };

  return (
    <Card>
      <div id="github" className="scroll-mt-6" />
      <CardHeader
        title="Synchronisation GitHub"
        subtitle="Vos données et vos documents sont stockés dans un dépôt GitHub privé : sauvegarde, historique des versions, synchro entre appareils et compilation LaTeX."
      />
      {cfg && !editing ? (
        <div className="space-y-3 text-[13px]">
          <p className="flex items-center gap-2 text-ink-2">
            <CheckCircle2 className="size-4 text-success" />
            Connecté à{' '}
            <a href={`https://github.com/${cfg.owner}/${cfg.repo}`} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">
              {cfg.owner}/{cfg.repo}
            </a>
          </p>
          <p className={status.state === 'error' ? 'text-danger' : 'text-ink-3'}>
            {status.state === 'syncing'
              ? 'Synchronisation en cours…'
              : status.state === 'error'
                ? `Dernière synchro en échec : ${status.error}`
                : status.state === 'offline'
                  ? 'Hors ligne : les modifications sont gardées sur cet appareil et partiront au retour du réseau.'
                  : status.lastSync
                    ? `Dernière synchro ${fmtAgo(status.lastSync)}.`
                    : 'Synchronisation automatique quelques secondes après chaque modification.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button icon={<RefreshCw />} onClick={() => syncNow()} disabled={status.state === 'syncing'}>
              Synchroniser maintenant
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Changer de jeton
            </Button>
            <Button variant="danger-ghost" onClick={disconnect}>
              Déconnecter
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
          className="space-y-4"
        >
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-ink-2">
            <li>
              Un dépôt <strong>privé</strong> (par défaut <code className="rounded bg-surface-2 px-1">trajectoire-donnees</code>).{' '}
              <a href="https://github.com/new?name=trajectoire-donnees&visibility=private" target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">
                Le créer
              </a>{' '}
              s'il n'existe pas.
            </li>
            <li>
              Un{' '}
              <a href={TOKEN_URL} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">
                jeton GitHub « fine-grained »
              </a>{' '}
              limité à ce seul dépôt, avec les droits <em>Contents : Read and write</em> et <em>Actions : Read and write</em>.
            </li>
          </ol>
          <FormGrid>
            <Field label="Propriétaire (compte GitHub)">{(id) => <Input id={id} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="ex. SolthaX" />}</Field>
            <Field label="Dépôt privé">{(id) => <Input id={id} value={repo} onChange={(e) => setRepo(e.target.value)} />}</Field>
          </FormGrid>
          <Field label="Jeton" hint="Gardé uniquement dans ce navigateur. Il n'est jamais synchronisé.">
            {(id) => (
              <Input id={id} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg ? '•••••••• (inchangé si vide)' : 'github_pat_…'} autoComplete="off" />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            {cfg && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Vérification…' : 'Connecter'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function BackupCard() {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = async () => {
    const data = await api.get<unknown>('/backup');
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trajectoire-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const restore = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const ok = await confirm({
        title: 'Restaurer cette sauvegarde ?',
        message: 'Toutes les données actuelles (entreprises, contacts, offres…) seront remplacées, sur cet appareil puis, après synchro, partout. Le dépôt GitHub garde l\u2019historique des versions précédentes.',
        confirmLabel: 'Restaurer',
        danger: true,
      });
      if (!ok) return;
      await api.post('/backup', json);
      await refreshAll(qc);
      toast.success('Sauvegarde restaurée');
    } catch (e) {
      toast.error(`Restauration impossible : ${errorMessage(e)}`);
    }
  };

  return (
    <Card>
      <CardHeader title="Sauvegarde" subtitle="Les données sont enregistrées dans ce navigateur et, si GitHub est connecté, dans votre dépôt privé (avec tout l'historique)." />
      <div className="flex flex-wrap gap-2">
        <Button icon={<Download />} onClick={exportJson}>
          Exporter (JSON)
        </Button>
        <Button icon={<Upload />} onClick={() => fileRef.current?.click()}>
          Restaurer…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) restore(f);
            e.target.value = '';
          }}
        />
      </div>
    </Card>
  );
}

export function SettingsPage() {
  // Sur téléphone, on commence par la connexion par QR code (pas de jeton à retaper).
  const onPhone = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return (
    <>
      <PageHeader title="Paramètres" description="Synchronisation, iPhone, calendrier, profil, critères de notation et sauvegarde." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {onPhone && <PhoneCard />}
          <GithubCard />
          {!onPhone && <PhoneCard />}
          <CalendarSyncCard />
          <LatexEngineCard />
          <ZenLinksCard />
          <ProfileCard />
          <BackupCard />
        </div>
        <CriteriaCard />
      </div>
    </>
  );
}
