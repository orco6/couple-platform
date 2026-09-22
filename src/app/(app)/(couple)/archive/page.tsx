import { requirePermissionPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { PageHeader } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { copy } from '@/domain/copy';
import { partnersOf } from '@/domain/partners';
import { listArchivedTasks } from '@/domain/tasks/tasks';

import { ArchiveList } from '../_components/ArchiveList';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.archivePage.pageTitle };

/**
 * THE ARCHIVE — SCREEN_BUILDING_PLAYBOOK.
 *
 *  1 Primary task: "למצוא משימה שהוצאנו מהרשימה, ולהחזיר אותה אם צריך".
 *  2 What matters most: the title and the reason it left. The reason is the
 *    thing a person comes back for.
 *  3 Secondary: whose it was and which day it belonged to.
 *  4 Actions: one — restoring, which collects its own reason (R-TASK-05).
 *  5 Shape: cards, like the list it came from, with the title struck through
 *    so the state is visible before any label is read.
 *  6 Phone: one column; the restore button is a full-width secondary.
 *  7 Loading: the (app) skeleton.
 *  8 Empty: the ordinary state here, and the copy says so rather than
 *    apologising — most couples will never open this screen.
 *  9 Errors: a stale version shows the list's own message and keeps the row.
 * 10 Unauthorized: `archive.read`, and the restore button appears only when
 *    the server would accept it (the view's capability flag).
 * 11/12 RTL, with the date LTR.
 * 13 Audit: `task.archived` / `task.restored`, both with the reason.
 * 14 Confirmation: yes, and it is where the reason is collected.
 * 15 Avoided tells: no "trash", no delete, no bulk selection.
 * 16 Specific to this product: nothing is ever deleted, so "archive" is the
 *    end of the line and it stays readable.
 */
export default async function ArchivePage() {
  const actor = await requirePermissionPage('archive.read');

  const [{ me, other }, tasks] = await Promise.all([partnersOf(db, actor), listArchivedTasks(db, actor)]);

  return (
    <Screen>
      <PageHeader title={copy.archivePage.pageTitle} description={copy.archivePage.description} />

      {tasks.length === 0 ? (
        <EmptyState title={copy.archivePage.emptyTitle} description={copy.archivePage.emptyWhy} />
      ) : (
        <ArchiveList tasks={tasks} me={me} partner={other} />
      )}
    </Screen>
  );
}
