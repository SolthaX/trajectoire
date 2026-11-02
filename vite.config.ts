import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/ (BASE_PATH fourni par le workflow).
const base = process.env.BASE_PATH ?? '/';

/**
 * Web app installable : génère le service worker avec la liste exacte des fichiers
 * compilés (fonctionnement hors ligne) et copie index.html en 404.html pour que
 * GitHub Pages serve l'app sur toutes les adresses (/entreprises/12, etc.).
 */
function pwa(): Plugin {
  let outDir = 'dist';
  return {
    name: 'trajectoire-pwa',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.html'));
      const version = Date.now().toString(36);
      const assets = ['./', ...files, 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(version, assets) });
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html');
      if (existsSync(index)) copyFileSync(index, resolve(outDir, '404.html'));
      // Chrome résout l'id du manifeste depuis la racine du domaine : « ./ » donnerait
      // https://solthax.github.io/ pour toutes les apps Pages, qui s'écraseraient à l'installation.
      const { id } = JSON.parse(readFileSync(resolve(outDir, 'manifest.webmanifest'), 'utf8'));
      if (base !== '/' && id !== base) {
        throw new Error(`manifest.webmanifest : "id" vaut "${id}", attendu "${base}" (identité unique de l'app installée).`);
      }
    },
  };
}

function serviceWorker(version: string, assets: string[]) {
  return `// Généré à la compilation. Coquille de l'app en cache : elle s'ouvre même hors ligne.
const CACHE = 'trajectoire-${version}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (e) => {
  // cache: 'reload' : contourne le cache HTTP (10 min sur Pages) pour ne pas figer un vieux manifeste.
  const fresh = ASSETS.map((a) => new Request(a, { cache: 'reload' }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // On garde la version précédente : un onglet encore ouvert peut en charger un morceau.
  e.waitUntil(
    caches.keys().then(async (keys) => {
      const older = keys.filter((k) => k.startsWith('trajectoire-') && k !== CACHE);
      await Promise.all(older.slice(0, -1).map((k) => caches.delete(k)));
      await self.clients.claim();
    }),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Réseau d'abord (dernière version), sinon la coquille en cache.
    e.respondWith(fetch(req).catch(() => caches.match('./', { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), pwa()],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
});
