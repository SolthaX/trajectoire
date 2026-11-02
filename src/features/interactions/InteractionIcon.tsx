import { Mail, MessageCircle, Phone, Send, StickyNote, Users } from 'lucide-react';
import { LinkedinIcon } from '../../components/badges';

export function InteractionIcon({ type, className = 'size-4' }: { type: string; className?: string }) {
  switch (type) {
    case 'email':
      return <Mail className={className} />;
    case 'appel':
      return <Phone className={className} />;
    case 'linkedin':
      return <LinkedinIcon className={className} />;
    case 'whatsapp':
      return <MessageCircle className={className} />;
    case 'rdv':
      return <Users className={className} />;
    case 'candidature':
      return <Send className={className} />;
    default:
      return <StickyNote className={className} />;
  }
}
