import { requirePermissionPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { listSettings } from '@/core/settings/settings';
import { PageHeader } from '@/core/ui/components/Layout';
import { SettingRow } from './SettingRow';

export const metadata = { title: 'הגדרות' };

export default async function SettingsPage() {
  const actor = await requirePermissionPage('settings.manage');
  const settings = await listSettings(db, actor);
  return (
    <>
      <PageHeader title="הגדרות" description="הגדרות העסק שאפשר לשנות בלי פיתוח. כל שינוי נרשם ביומן, ולא משנה רשומות מהעבר." />
      <ul className="surface divide-y divide-rule-faint">
        {settings.map((setting) => (
          <li key={setting.key} className="px-4 py-4 sm:px-5">
            <SettingRow setting={setting} />
          </li>
        ))}
      </ul>
    </>
  );
}
