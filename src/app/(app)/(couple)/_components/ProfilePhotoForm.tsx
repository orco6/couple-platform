'use client';

import { Camera } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/core/ui/components/Toast';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';

import { BusyLabel } from './CoupleLoader';
import { PartnerAvatar } from './PartnerAvatar';
import { squarePortrait } from './shrink-photo';

/**
 * MY PHOTO — the face next to my name, for both of us. Pick one (the phone's
 * own picker: camera or library), it is shrunk on the phone and saved at once;
 * or remove it and go back to the light.
 */
export function ProfilePhotoForm({ me }: { me: PartnerRef }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState<'set' | 'remove' | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const busy = saving !== null || refreshing;

  async function send(init: RequestInit, kind: 'set' | 'remove') {
    setSaving(kind);
    try {
      const response = await fetch('/api/profile-photo', { ...init, credentials: 'same-origin' });
      if (!response.ok) throw new Error(String(response.status));
      toast.show(kind === 'set' ? copy.settings.photoSaved : copy.settings.photoRemoved, 'success');
      startRefresh(() => router.refresh());
    } catch {
      toast.show(copy.tasks.photoFailed, 'error');
    } finally {
      setSaving(null);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    let blob: Blob;
    try {
      blob = await squarePortrait(file);
    } catch {
      toast.show(copy.tasks.photoNotImage, 'error');
      return;
    }
    await send({ method: 'PUT', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob }, 'set');
  }

  return (
    <div className="figure-card flex items-center gap-4 px-5 py-4">
      <PartnerAvatar person={me} size={4.5} />
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-busy={saving === 'set' || undefined}
          disabled={busy}
          className="tap-quiet press inline-flex min-h-11 items-center gap-2 rounded-chip px-4 text-body font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-rule-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <BusyLabel busy={saving === 'set'}>
            <Camera aria-hidden="true" size={18} />
            {me.photo ? copy.settings.photoChange : copy.settings.photoChoose}
          </BusyLabel>
        </button>
        {me.photo && (
          <button
            type="button"
            onClick={() => void send({ method: 'DELETE' }, 'remove')}
            aria-busy={saving === 'remove' || undefined}
            disabled={busy}
            className="tap-quiet press min-h-11 rounded-chip px-4 text-body text-danger-text focus-visible:outline-2 focus-visible:outline-focus"
          >
            <BusyLabel busy={saving === 'remove'}>{copy.settings.photoRemove}</BusyLabel>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={copy.settings.photoChoose}
          data-testid="profile-photo-input"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
