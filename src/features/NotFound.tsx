import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui/button';
import { EmptyState } from '../components/ui/misc';

export function NotFound() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page introuvable"
      description="Cette page n'existe pas ou plus."
      action={<ButtonLink to="/">Retour à l'accueil</ButtonLink>}
    />
  );
}
