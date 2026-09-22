import { access } from '@/domain/contract';
import { requireActorPage } from '@/core/auth/page-guards';
import { DescriptionList, PageHeader, Panel, Section } from '@/core/ui/components/Layout';
import { Ltr } from '@/core/ui/components/Text';
import { ChangePasswordForm } from './ChangePasswordForm';
import { SignOutEverywhere } from './SignOutEverywhere';

export const metadata = { title: 'החשבון שלי' };

export default async function AccountPage() {
  const actor = await requireActorPage();
  return (
    <>
      <PageHeader title="החשבון שלי" />
      <Section title="פרטים">
        <Panel>
          <DescriptionList
            columns={3}
            items={[
              { label: 'שם', value: actor.name },
              { label: 'שם משתמש', value: <Ltr>{actor.username}</Ltr> },
              { label: 'תפקיד', value: access.roleLabel(actor.role) },
            ]}
          />
        </Panel>
      </Section>
      <Section title="החלפת סיסמה">
        <Panel className="max-w-lg">
          <ChangePasswordForm mode="voluntary" />
        </Panel>
      </Section>
      <Section title="חיבורים" description="אם נשארת מחובר/ת במכשיר אחר או במחשב משותף.">
        <SignOutEverywhere />
      </Section>
      <p className="text-meta text-ink-subtle">
        גרסה <Ltr>{process.env.APP_VERSION}</Ltr>
      </p>
    </>
  );
}
