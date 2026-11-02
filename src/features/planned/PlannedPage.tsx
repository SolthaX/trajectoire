import { Card } from '../../components/ui/misc';
import { PageHeader } from '../../components/ui/misc';
import { Timeline } from '../interactions/Timeline';

/** Mails, messages (LinkedIn, WhatsApp, SMS) et calls préparés mais pas encore faits. */
export function PlannedPage() {
  return (
    <>
      <PageHeader title="À envoyer" description="Mails, messages LinkedIn, WhatsApp, SMS et calls préparés, du plus proche au plus lointain." />
      <Card>
        <Timeline filter={{}} plannedOnly showCompany compactEmpty={false} />
      </Card>
    </>
  );
}
