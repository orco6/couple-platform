'use client';

import { useState } from 'react';
import { Button } from '@/core/ui/components/Button';
import { FormField, Input } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { PasswordField } from '@/core/ui/components/PasswordField';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { navigateAfterSessionChange } from '@/core/http/navigation';
import { normalizePasswordInput } from '@/core/auth/password-input';
import { submittedValue } from '@/core/ui/form-values';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { submit, pending, formError, fieldErrors, clearOnInput } = useSubmit();

  return (
    <form method="post" onInput={clearOnInput}
      noValidate
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        // What is in the fields, not only what React saw (password managers, typing before hydration).
        const form = event.currentTarget;
        const result = await submit<{ mustChangePassword: boolean }>('/api/auth/login', {
          body: {
            username: submittedValue(form, 'username', username),
            password: normalizePasswordInput(submittedValue(form, 'password', password)),
          },
        });
        if (result) {
          // A full navigation, so every server component re-renders with the new session.
          navigateAfterSessionChange(result.mustChangePassword ? '/change-password' : nextPath);
        }
      }}
    >
      <FormField name="username" label="שם משתמש" required error={fieldErrors.username}>
        {(props) => (
          <Input
            {...props}
            name="username"
            dir="ltr"
            className="text-start"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        )}
      </FormField>
      <PasswordField
        label="סיסמה"
        name="password"
        autoComplete="current-password"
        enterKeyHint="go"
        value={password}
        onChange={setPassword}
        error={fieldErrors.password}
      />
      <FormError message={formError} />
      <Button type="submit" variant="primary" loading={pending} className="mt-1 w-full">
        כניסה
      </Button>
      <p className="text-meta text-ink-subtle">שכחת סיסמה? מנהל המערכת יכול לאפס אותה.</p>
    </form>
  );
}
