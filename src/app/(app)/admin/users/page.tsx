import { can } from '@/core/access/can';
import { requirePermissionPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { PageHeader } from '@/core/ui/components/Layout';
import { assignableRoles, listUsers } from '@/core/users/users';
import { UsersBoard } from './UsersBoard';

export const metadata = { title: 'משתמשים' };

export default async function UsersPage() {
  const actor = await requirePermissionPage('users.read');
  const users = await listUsers(db, actor);
  return (
    <>
      <PageHeader title="משתמשים" description="מנהלים לא רואים סיסמאות. יצירת משתמש ואיפוס סיסמה מייצרים סיסמה זמנית שמוצגת פעם אחת בלבד." />
      <UsersBoard users={users} roles={assignableRoles(actor)} canManage={can(actor, 'users.manage')} currentUserId={actor.id} />
    </>
  );
}
