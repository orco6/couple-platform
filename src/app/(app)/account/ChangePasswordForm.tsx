'use client';

import { useState } from 'react';
import { PASSWORD_MIN_LENGTH } from '@/core/auth/password-policy';
import { copy } from '@/core/copy';
import { Button } from '@/core/ui/components/Button';
import { FormError } from '@/core/ui/components/Layout';
import { PasswordField } from '@/core/ui/components/PasswordField';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { navigateAfterSessionChange } from '@/core/http/navigation';
import { normalizePasswordInput } from '@/core/auth/password-input';
import { submittedValue } from '@/core/ui/form-values';

export function ChangePasswordForm({ mode }: { mode: 'forced' | 'voluntary' }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const { submit, pending, formError, fieldErrors, clearOnInput } = useSubmit();
  const toast = useToast();

  return (
    <form method="post" onInput={clearOnInput}
      noValidate
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const read = (name: string, fallback: string) => normalizePasswordInput(submittedValue(form, name, fallback));
        const current = read('currentPassword', currentPassword);
        const next = read('newPassword', newPassword);
        if (next !== read('confirmation', confirmation)) {
          setConfirmError(copy.auth.passwordsDoNotMatch);
          return;
        }
        setConfirmError(undefined);
        const result = await submit('/api/auth/password', { body: { currentPassword: current, newPassword: next } });
        if (!result) return;
        if (mode === 'forced') {
          navigateAfterSessionChange('/');
        } else {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmation('');
          toast.show('הסיסמה עודכנה. חיבורים אחרים לחשבון נותקו.');
        }
      }}
    >
      {/* Lets password managers associate the new password with the account. */}
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <PasswordField
        label={mode === 'forced' ? 'הסיסמה הזמנית' : 'הסיסמה הנוכחית'}
        name="currentPassword"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
        error={fieldErrors.currentPassword}
      />
      <PasswordField
        label="סיסמה חדשה"
        name="newPassword"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        error={fieldErrors.newPassword}
        hint={`לפחות ${PASSWORD_MIN_LENGTH} תווים. משפט קצר שקל לזכור עדיף על צירוף סימנים.`}
      />
      <PasswordField
        label="אימות הסיסמה החדשה"
        name="confirmation"
        autoComplete="new-password"
        value={confirmation}
        onChange={(value) => {
          setConfirmation(value);
          if (confirmError && value === newPassword) setConfirmError(undefined);
        }}
        error={confirmError}
      />
      <FormError message={formError} />
      <Button type="submit" variant="primary" loading={pending} className="mt-1 w-full sm:w-auto">
        {mode === 'forced' ? 'שמירה והמשך' : 'עדכון הסיסמה'}
      </Button>
    </form>
  );
}
