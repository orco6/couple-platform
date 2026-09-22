'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/core/ui/components/Button';
import { RadioGroup } from '@/core/ui/components/Choice';
import { ConfirmDialog, Dialog } from '@/core/ui/components/Dialog';
import { FormField, Input } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { StatusBadge } from '@/core/ui/components/StatusBadge';
import { DateTimeText, Ltr } from '@/core/ui/components/Text';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { UserView } from '@/core/users/users';

type RoleOption = { value: string; label: string; description: string };

export function UsersBoard({
  users,
  roles,
  canManage,
  currentUserId,
}: {
  users: UserView[];
  roles: RoleOption[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<UserView | null>(null);
  const [temporary, setTemporary] = useState<{ name: string; username: string; password: string } | null>(null);

  return (
    <>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" onClick={() => setCreating(true)}>
            משתמש חדש
          </Button>
        </div>
      )}

      <ul className="surface divide-y divide-rule-faint">
        {users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              disabled={!user.manageable}
              onClick={() => setSelected(user)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-start enabled:hover:bg-hover disabled:cursor-default"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-row font-medium text-ink">
                  {user.name}
                  {user.id === currentUserId && <span className="ms-2 text-meta font-normal text-ink-subtle">(את/ה)</span>}
                </span>
                <span className="block text-label text-ink-muted">
                  <Ltr>{user.username}</Ltr> · {user.roleLabel}
                </span>
              </span>
              <span className="flex items-center gap-3 text-meta text-ink-subtle">
                {user.mustChangePassword && user.status === 'ACTIVE' && <StatusBadge label="ממתין לסיסמה אישית" tone="warning" />}
                {user.status === 'DISABLED' ? <StatusBadge label="מושבת" tone="muted" /> : null}
                <span className="hidden sm:inline">
                  כניסה אחרונה: {user.lastLoginAt ? <DateTimeText value={user.lastLoginAt} /> : 'אף פעם'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <CreateUserDialog
        open={creating}
        roles={roles}
        onClose={() => setCreating(false)}
        onCreated={(result) => {
          setCreating(false);
          setTemporary(result);
        }}
      />
      <ManageUserDialog
        user={selected}
        roles={roles}
        onClose={() => setSelected(null)}
        onPasswordReset={(password) => {
          if (selected) setTemporary({ name: selected.name, username: selected.username, password });
          setSelected(null);
        }}
      />
      <TemporaryPasswordDialog value={temporary} onClose={() => setTemporary(null)} />
    </>
  );
}

function CreateUserDialog({
  open,
  roles,
  onClose,
  onCreated,
}: {
  open: boolean;
  roles: RoleOption[];
  onClose: () => void;
  onCreated: (result: { name: string; username: string; password: string }) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string | null>(roles.at(-1)?.value ?? null);
  const { submit, pending, fieldErrors, formError, reset, clearOnInput } = useSubmit();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="משתמש חדש"
      description="תיווצר סיסמה זמנית. המשתמש יתבקש לבחור סיסמה אישית בכניסה הראשונה."
      footer={
        <div className="flex gap-2.5 sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending} className="flex-1 sm:flex-none">
            ביטול
          </Button>
          <Button type="submit" form="create-user" variant="primary" loading={pending} className="flex-1 sm:flex-none">
            יצירת המשתמש
          </Button>
        </div>
      }
    >
      <form method="post" onInput={clearOnInput}
        id="create-user"
        noValidate
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await submit<{ user: UserView; temporaryPassword: string }>('/api/admin/users', {
            body: { name, username, email, role: role ?? '' },
          });
          if (!result) return;
          reset();
          setName('');
          setUsername('');
          setEmail('');
          onCreated({ name: result.user.name, username: result.user.username, password: result.temporaryPassword });
          router.refresh();
        }}
      >
        <FormField name="name" label="שם" required error={fieldErrors.name}>
          {(props) => <Input {...props} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />}
        </FormField>
        <FormField name="username" label="שם משתמש" required error={fieldErrors.username} hint="אותיות באנגלית, ספרות, נקודה או מקף.">
          {(props) => (
            <Input {...props} dir="ltr" className="text-start" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} />
          )}
        </FormField>
        <FormField name="email" label="דוא״ל" error={fieldErrors.email}>
          {(props) => <Input {...props} type="email" dir="ltr" className="text-start" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />}
        </FormField>
        <RadioGroup legend="תפקיד" name="role" value={role} onChange={setRole} options={roles} error={fieldErrors.role} />
        <FormError message={formError} />
      </form>
    </Dialog>
  );
}

function ManageUserDialog({
  user,
  roles,
  onClose,
  onPasswordReset,
}: {
  user: UserView | null;
  roles: RoleOption[];
  onClose: () => void;
  onPasswordReset: (password: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'disable' | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const { submit, pending, fieldErrors, formError, reset, clearOnInput } = useSubmit();

  if (user && loadedFor !== user.id) {
    setLoadedFor(user.id);
    setName(user.name);
    setEmail(user.email ?? '');
    setRole(user.role);
    reset();
  }

  const done = (message: string) => {
    toast.show(message);
    router.refresh();
    onClose();
  };

  return (
    <>
      <Dialog
        open={user !== null && confirm === null}
        onClose={() => {
          setLoadedFor(null);
          onClose();
        }}
        dismissible={!pending}
        title={user?.name ?? ''}
        description={user ? <Ltr>{user.username}</Ltr> : undefined}
        footer={
          <div className="flex gap-2.5 sm:justify-end">
            <Button type="submit" form="manage-user" variant="primary" loading={pending} className="flex-1 sm:flex-none">
              שמירת פרטים
            </Button>
          </div>
        }
      >
        {user && (
          <div className="grid gap-6">
            <form method="post" onInput={clearOnInput}
              id="manage-user"
              noValidate
              className="grid gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await submit(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { name, email, role: role ?? undefined } });
                if (result) done('פרטי המשתמש נשמרו');
              }}
            >
              <FormField name="name" label="שם" required error={fieldErrors.name}>
                {(props) => <Input {...props} value={name} onChange={(event) => setName(event.target.value)} />}
              </FormField>
              <FormField name="email" label="דוא״ל" error={fieldErrors.email}>
                {(props) => <Input {...props} type="email" dir="ltr" className="text-start" value={email} onChange={(event) => setEmail(event.target.value)} />}
              </FormField>
              <RadioGroup legend="תפקיד" name="manage-role" value={role} onChange={setRole} options={roles} error={fieldErrors.role} />
              <FormError message={formError} />
            </form>

            <div className="grid gap-3 border-t border-rule-faint pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-row font-medium">איפוס סיסמה</p>
                  <p className="text-label text-ink-muted">יוצר סיסמה זמנית ומנתק את כל החיבורים של המשתמש.</p>
                </div>
                <Button variant="secondary" onClick={() => setConfirm('reset')}>
                  איפוס סיסמה
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-row font-medium">{user.status === 'ACTIVE' ? 'השבתת המשתמש' : 'הפעלת המשתמש'}</p>
                  <p className="text-label text-ink-muted">
                    {user.status === 'ACTIVE' ? 'המשתמש לא יוכל להתחבר. ההיסטוריה שלו נשמרת.' : 'המשתמש יוכל להתחבר שוב.'}
                  </p>
                </div>
                {user.status === 'ACTIVE' ? (
                  <Button variant="quiet" className="text-danger-text" onClick={() => setConfirm('disable')}>
                    השבתה
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    loading={pending}
                    onClick={async () => {
                      const result = await submit(`/api/admin/users/${user.id}/status`, { body: { status: 'ACTIVE' } });
                      if (result) done('המשתמש הופעל');
                    }}
                  >
                    הפעלה
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirm === 'reset'}
        tone="default"
        title={`איפוס הסיסמה של ${user?.name ?? ''}`}
        body="הסיסמה הנוכחית תפסיק לעבוד מיד וכל החיבורים הפעילים של המשתמש ינותקו. הסיסמה הזמנית תוצג פעם אחת."
        confirmLabel="איפוס סיסמה"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!user) return;
          const result = await submit<{ temporaryPassword: string }>(`/api/admin/users/${user.id}/password-reset`, { method: 'POST', body: {} });
          setConfirm(null);
          if (result) onPasswordReset(result.temporaryPassword);
        }}
      >
        <FormError message={formError} />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'disable'}
        title={`השבתת ${user?.name ?? ''}`}
        body="המשתמש ינותק מיד ולא יוכל להתחבר. כל הרשומות וההיסטוריה שלו נשמרות, ואפשר להפעיל אותו שוב."
        confirmLabel="השבתה"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!user) return;
          const result = await submit(`/api/admin/users/${user.id}/status`, { body: { status: 'DISABLED' } });
          setConfirm(null);
          if (result) done('המשתמש הושבת');
        }}
      >
        <FormError message={formError} />
      </ConfirmDialog>
    </>
  );
}

function TemporaryPasswordDialog({
  value,
  onClose,
}: {
  value: { name: string; username: string; password: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open={value !== null}
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      size="sm"
      title="סיסמה זמנית"
      description="מוצגת פעם אחת בלבד. אחרי סגירת החלון אי אפשר לראות אותה שוב."
      footer={
        <Button variant="primary" className="w-full" onClick={onClose}>
          העברתי את הסיסמה
        </Button>
      }
    >
      {value && (
        <div className="grid gap-3">
          <p className="text-body text-ink-muted">
            עבור {value.name} (<Ltr>{value.username}</Ltr>). בכניסה הראשונה תתבקש/יתבקש סיסמה אישית.
          </p>
          <div className="flex items-center gap-2 rounded-control border border-rule-strong bg-sunken px-3 py-2">
            <code dir="ltr" data-testid="temporary-password" className="tnum flex-1 select-all text-start text-section font-semibold tracking-wide">
              {value.password}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard?.writeText(value.password).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? 'הועתק' : 'העתקה'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
