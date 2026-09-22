'use client';

import { useState } from 'react';
import { normalizePasswordInput, wouldNormalizePassword } from '@/core/auth/password-input';
import { copy } from '@/core/copy';
import { FormField, Input } from './Field';
import { EyeIcon, EyeOffIcon } from './Icons';

/**
 * Password input: reveal toggle, paste cleaning, correct autocomplete.
 *
 * The value is normalized as it is typed or pasted (same function the server
 * uses), so what is shown, validated and submitted is one string. When a paste
 * contained invisible characters, a hint says so instead of silently editing.
 *
 * autocomplete: "current-password" for sign-in and the current-password field,
 * "new-password" for choosing one — this is what makes password managers offer
 * to fill or to generate correctly.
 */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  name,
  required = true,
  autoFocus,
  enterKeyHint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete: 'current-password' | 'new-password';
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  enterKeyHint?: 'go' | 'next' | 'done';
}) {
  const [revealed, setRevealed] = useState(false);
  const [cleaned, setCleaned] = useState(false);

  return (
    <FormField label={label} error={error} hint={cleaned ? copy.auth.pastedCharactersRemoved : hint} required={required}>
      {(props) => (
        <Input
          {...props}
          name={name}
          type={revealed ? 'text' : 'password'}
          dir="ltr"
          className="text-start"
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          enterKeyHint={enterKeyHint}
          value={value}
          onChange={(event) => {
            const raw = event.target.value;
            // Say so only when something invisible was removed — not for an ordinary trailing space.
            setCleaned(wouldNormalizePassword(raw.trim()));
            onChange(normalizePasswordInput(raw));
          }}
          trailing={
            <button
              type="button"
              onClick={() => setRevealed((shown) => !shown)}
              aria-label={revealed ? copy.common.hidePassword : copy.common.showPassword}
              aria-pressed={revealed}
              className="flex size-10 items-center justify-center rounded-control text-ink-subtle hover:text-ink"
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          }
        />
      )}
    </FormField>
  );
}
