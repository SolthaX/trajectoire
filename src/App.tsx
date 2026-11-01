import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { CompaniesPage } from './features/companies/CompaniesPage';
import { CompanyPage } from './features/companies/CompanyPage';
import { ContactsPage } from './features/contacts/ContactsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { InterviewsPage } from './features/interviews/InterviewsPage';
import { JobPage } from './features/jobs/JobPage';
import { JobsPage } from './features/jobs/JobsPage';
import { PipelinePage } from './features/pipeline/PipelinePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TemplatesPage } from './features/templates/TemplatesPage';
import { NotFound } from './features/NotFound';

// Le module Documents (éditeurs LaTeX / texte riche) est chargé à la demande.
const DocumentsPage = lazy(() => import('./features/documents/DocumentsPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
      { path: 'entreprises', element: <CompaniesPage /> },
      { path: 'entreprises/:id', element: <CompanyPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'offres', element: <JobsPage /> },
      { path: 'offres/:id', element: <JobPage /> },
      { path: 'entretiens', element: <InterviewsPage /> },
      { path: 'modeles', element: <TemplatesPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'parametres', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });
