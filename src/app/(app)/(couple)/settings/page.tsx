import { requireActorPage } from '@/core/auth/page-guards';
import { can } from '@/core/access/can';
import { db } from '@/core/db/client';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { copy } from '@/domain/copy';
import { reviewTimeOf } from '@/domain/day-entries/day-entries';
import { getPartnership, listLinkableUsers, partnersOf } from '@/domain/partners';

import { PartnerLinkForm } from '../_components/PartnerLinkForm';
import { ProfilePhotoForm } from '../_components/ProfilePhotoForm';
import { ReviewTimeForm } from '../_components/ReviewTimeForm';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.settings.pageTitle };

/**
 * SETTINGS — SCREEN_BUILDING_PLAYBOOK, briefly, because there are two things
 * on it and that is the point.
 *
 *  1 Primary task: "לשנות את השעה שבה נסגר היום".
 *  2 What matters most: the hour. It is the one number that changes how the
 *    product behaves, and it is set once and then forgotten.
 *  3 Secondary: who the couple is — a fact worth seeing, since it is the
 *    boundary every other screen is scoped by.
 *  4 Actions: save the time; link the second partner (owner only).
 *  5 Shape: two cards. Not a settings table: two rows do not need a table,
 *    and a couple should never feel they have opened a preferences screen.
 *  6 Phone: one column, the time field at its natural width, buttons full
 *    width until there is room for them not to be.
 *  7/8/9 States: nobody linked yet (the common first-run state), linked,
 *    and read-only for the partner who may not change the shared time.
 * 10 Unauthorized: the page guard, then each control is rendered only if the
 *    server would accept it — the time is read-only text without
 *    `settings.manage`, and the link form is absent without `users.manage`.
 * 11/12 RTL, with the time itself LTR.
 * 13 Audit: `setting.changed` and `partnership.linked`, both in the services.
 * 14 Confirmation: none. Both changes are visible and reversible.
 * 15 Avoided tells: no toggles nobody asked for, no "advanced" section, no
 *    account management — that lives in the platform's own screens.
 * 16 Specific to this product: the shared hour is shared, so one partner
 *    cannot move it quietly (R-SET-02).
 */
export default async function SettingsPage() {
  const actor = await requireActorPage();

  const [reviewTime, partnership, { me }] = await Promise.all([reviewTimeOf(db), getPartnership(db, actor), partnersOf(db, actor)]);
  // Only the owner may link, and only the owner may be shown the list of
  // people — it is the one place this product names other accounts.
  const linkable = can(actor, 'users.manage') ? await listLinkableUsers(db, actor) : [];

  return (
    <Screen>
      <PageHeader title={copy.settings.pageTitle} />

      {can(actor, 'profile.photo') && (
        <Section title={copy.settings.photoTitle} description={copy.settings.photoHint}>
          <ProfilePhotoForm me={me} />
        </Section>
      )}

      <Section>
        <ReviewTimeForm value={reviewTime} canManage={can(actor, 'settings.manage')} />
      </Section>

      <Section title={copy.settings.partnerTitle} className="mb-0">
        <PartnerLinkForm partnership={partnership} linkable={linkable} />
      </Section>
    </Screen>
  );
}
