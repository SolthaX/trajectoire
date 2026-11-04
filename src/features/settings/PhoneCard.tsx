// « Sur votre iPhone » : installer l'app sur l'écran d'accueil et y transférer la connexion GitHub
// par QR code (ou code copié), sans retaper le jeton.

import jsQR from 'jsqr';
import { Camera, ClipboardPaste, Copy, Eye, EyeOff, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { syncNow } from '../../backend/sync';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/form';
import { Dialog } from '../../components/ui/overlay';
import { Card, CardHeader } from '../../components/ui/misc';
import { errorMessage } from '../../lib/api';
import { applyConnexion, decodeConnexion, encodeConnexion } from '../../lib/connexion';
import { useGithubConfig } from '../../lib/github';
import { isStandalone } from '../../lib/pwa';

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const appUrl = () => new URL(import.meta.env.BASE_URL, location.origin).href;
const CODE_VISIBLE_MS = 2 * 60_000;

function Qr({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0f2a30', light: '#ffffff' } })
      .then((u) => alive && setSrc(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text]);
  return src ? <img src={src} alt={label} className="size-[180px] rounded-lg border border-line bg-white p-1.5" /> : <div className="size-[180px]" />;
}

/** Lecture d'un QR code avec la caméra arrière (iPhone : fonctionne dans l'app installée). */
function Scanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (s: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stopped) return;
          if (v.videoWidth && ctx) {
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = v.videoWidth * scale;
            canvas.height = v.videoHeight * scale;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (found?.data) return onCodeRef.current(found.data);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Caméra inaccessible. Autorisez-la (Réglages → Safari → Caméra), ou collez le code à la place.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      setError('');
    };
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Scanner le code de connexion" description="Visez le QR code affiché dans Paramètres sur l'ordinateur.">
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : (
        <video ref={video} playsInline muted className="aspect-square w-full rounded-lg bg-black object-cover" />
      )}
    </Dialog>
  );
}

export function PhoneCard() {
  const cfg = useGithubConfig();
  const [showCode, setShowCode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const onPhone = isIos() || matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    if (!showCode) return;
    const t = setTimeout(() => setShowCode(false), CODE_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [showCode]);

  const connect = async (raw: string) => {
    setScanning(false);
    const next = decodeConnexion(raw);
    if (!next) return toast.error("Ce n'est pas un code de connexion Trajectoire.");
    setBusy(true);
    try {
      const name = await applyConnexion(next);
      setPasted('');
      await syncNow();
      toast.success(`Connecté à ${name} : données synchronisées`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const code = cfg ? encodeConnexion(cfg) : '';
  const notInstalled = isIos() && !isStandalone();

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Smartphone className="size-4 text-ink-3" /> Sur votre iPhone
          </span>
        }
        subtitle="La même app, installée sur l'écran d'accueil et synchronisée avec le même dépôt GitHub."
      />
      <div className="space-y-5">
        {notInstalled && (
          <p className="rounded-lg border border-warning-ink/25 bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">
            Vous êtes dans Safari : installez d'abord l'app (Partager → « Sur l'écran d'accueil »), puis connectez-la depuis l'icône. L'app installée
            a ses propres données, séparées de Safari.
          </p>
        )}

        {!onPhone && (
          <ol className="list-decimal space-y-3 pl-5 text-[13px] text-ink-2">
            <li>
              <strong>Ouvrir l'app sur l'iPhone :</strong> visez ce QR code avec l'appareil photo, puis touchez le lien (il s'ouvre dans Safari).
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <Qr text={appUrl()} label="Adresse de Trajectoire" />
                <span className="font-mono text-[12px] break-all text-ink-3">{appUrl()}</span>
              </div>
            </li>
            <li>
              <strong>L'installer :</strong> dans Safari, bouton <em>Partager</em> (carré avec une flèche) → <em>Sur l'écran d'accueil</em> → <em>Ajouter</em>.
              Ouvrez ensuite Trajectoire depuis son icône : elle s'affiche en plein écran, sans barre Safari, et fonctionne hors ligne.
            </li>
            <li>
              <strong>La connecter :</strong> dans l'app sur l'iPhone, onglet <em>Plus</em> → <em>Paramètres</em> → <em>Sur votre iPhone</em> →{' '}
              <em>Scanner le code</em>, et visez le code ci-dessous.
              {cfg ? (
                <div className="mt-2 space-y-2">
                  {showCode ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <Qr text={code} label="Code de connexion" />
                      <div className="space-y-2 text-[12px] text-ink-3">
                        <p className="max-w-[260px]">Ce code contient votre jeton GitHub : ne le montrez à personne. Il se masque dans 2 minutes.</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" icon={<Copy />} onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success('Code copié'))}>
                            Copier le code
                          </Button>
                          <Button size="sm" variant="ghost" icon={<EyeOff />} onClick={() => setShowCode(false)}>
                            Masquer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" icon={<Eye />} onClick={() => setShowCode(true)}>
                      Afficher le code de connexion
                    </Button>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-[12.5px] text-ink-3">Connectez d'abord cet ordinateur à GitHub (carte ci-dessus) pour obtenir le code.</p>
              )}
            </li>
            <li>
              <strong>Calendrier :</strong> avec la synchro iCloud activée, vos rendez-vous apparaissent aussi dans l'app Calendrier de l'iPhone.
            </li>
          </ol>
        )}

        <div className="space-y-2">
          <div className="text-[12.5px] font-medium text-ink-2">{onPhone ? 'Connecter cet iPhone' : 'Connecter cet appareil avec un code'}</div>
          {cfg && onPhone && <p className="text-[12.5px] text-ink-3">Cet appareil est déjà connecté à {cfg.owner}/{cfg.repo}. Un nouveau code remplacera la connexion.</p>}
          <div className="flex flex-wrap gap-2">
            {onPhone && (
              <Button variant="primary" icon={<Camera />} disabled={busy} onClick={() => setScanning(true)}>
                Scanner le code
              </Button>
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void connect(pasted);
            }}
          >
            <Input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="ou collez le code trajectoire-connexion:…" autoComplete="off" spellCheck={false} />
            <Button type="submit" icon={<ClipboardPaste />} disabled={busy || !pasted.trim()}>
              Connecter
            </Button>
          </form>
        </div>
      </div>
      <Scanner open={scanning} onClose={() => setScanning(false)} onCode={connect} />
    </Card>
  );
}
