import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { toast, Toaster } from 'sonner';
import { router } from './App';
import { initBackend } from './backend/app';
import { refreshAll } from './lib/api';
import { registerServiceWorker } from './lib/pwa';
import { installZenLinks } from './lib/zen';
import { ConfirmProvider } from './components/ui/overlay';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

// Liens externes dans Zen (si activé dans Paramètres, app installée uniquement).
installZenLinks();

// Démarre la base locale ; une synchro qui apporte des données rafraîchit l'interface.
void initBackend(() => void refreshAll(queryClient));

// Une nouvelle version publiée sur GitHub Pages est prête : on propose de recharger.
registerServiceWorker(() =>
  toast('Nouvelle version de Trajectoire disponible', {
    duration: Infinity,
    action: { label: 'Recharger', onClick: () => location.reload() },
  }),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '!rounded-xl !border-line !bg-surface !text-ink !shadow-md !text-[13px] !font-sans',
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
