'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SettingView } from '@/core/settings/settings';
import { Button } from '@/core/ui/components/Button';
import { FormField, Input } from '@/core/ui/components/Field';
import { DateTimeText } from '@/core/ui/components/Text';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';

/** One setting, saved on its own: a long settings dump with one save button hides what changed. */
export function SettingRow({ setting }: { setting: SettingView }) {
  const router = useRouter();
  const toast = useToast();
  const isRate = setting.input.kind === 'rate_bps';
  const initial = isRate ? String((setting.value as number) / 100) : String(setting.value);
  const [text, setText] = useState(initial);
  const { submit, pending, fieldErrors, formError, clearOnInput } = useSubmit();

  const toValue = () => {
    if (setting.input.kind === 'integer') return /^\d+$/.test(text.trim()) ? Number(text) : text;
    if (isRate) return /^\d+(\.\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text) * 100) : text;
    return text;
  };

  return (
    <form method="post" onInput={clearOnInput}
      noValidate
      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await submit(`/api/admin/settings/${encodeURIComponent(setting.key)}`, { method: 'PUT', body: { value: toValue() } });
        if (result) {
          toast.show('ההגדרה נשמרה');
          router.refresh();
        }
      }}
    >
      <FormField
        label={setting.label}
        error={fieldErrors.value ?? formError ?? undefined}
        hint={
          <>
            {setting.description}
            {setting.updatedByName && setting.updatedAt && (
              <span className="mt-1 block">
                עודכן על ידי {setting.updatedByName}, <DateTimeText value={setting.updatedAt} />
              </span>
            )}
          </>
        }
      >
        {(props) => (
          <div className="flex max-w-[12rem] items-center gap-2">
            <Input {...props} inputMode="decimal" dir="ltr" className="tnum text-start" value={text} onChange={(event) => setText(event.target.value)} />
            <span className="text-body text-ink-muted">{isRate ? '%' : setting.input.kind === 'integer' ? (setting.input.unit ?? '') : ''}</span>
          </div>
        )}
      </FormField>
      <Button type="submit" variant="secondary" loading={pending} disabled={text === initial}>
        שמירה
      </Button>
    </form>
  );
}
