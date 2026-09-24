'use client';

import { CalendarDays, Camera, Clock, Plus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { controlClasses, FormField } from '@/core/ui/components/Field';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { cx } from '@/core/ui/cx';
import { addDays, type CalendarDate } from '@/core/dates/calendar-date';
import type { LocalTime } from '@/core/dates/local-time';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { MAX_PHOTOS } from '@/domain/tasks/photo-limits';

import { Calendar } from './Calendar';
import { BusyLabel } from './CoupleLoader';
import { GrowingTextarea } from './GrowingTextarea';
import { PartnerAvatar } from './PartnerAvatar';
import { shrinkPhoto } from './shrink-photo';
import { PhotoViewer } from './PhotoViewer';
import { RatingBadge } from './TaskRow';

/**
 * iOS raises the keyboard only for a focus() made inside the tap itself, and
 * the composer's field does not exist yet at that moment. So the tap focuses a
 * throwaway input synchronously — placed exactly where the composer's field
 * will be, near the top, so Safari has no reason to scroll — and when the
 * composer moves focus into its own field the keyboard simply stays.
 */
export function primeKeyboard() {
  if (typeof document === 'undefined') return;
  const proxy = document.createElement('input');
  proxy.setAttribute('aria-hidden', 'true');
  proxy.tabIndex = -1;
  proxy.style.cssText =
    'position:fixed;top:calc(env(safe-area-inset-top) + 5rem);left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none;';
  document.body.appendChild(proxy);
  proxy.focus({ preventScroll: true });
  window.setTimeout(() => proxy.remove(), 800);
}

const shortDay = new Intl.DateTimeFormat('he-IL', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
});

/**
 * THE COMPOSER — adding a task, as close to writing a message as it gets.
 *
 *   ✕
 *   [ מה צריך?                          (↑) ]
 *   (● אני) (● נטיה)
 *   (היום) (מחר) (📅)          (🕒) (הערה)
 *
 * WHY FULL SCREEN, AND WHY AT THE TOP. On a real iPhone the third edition's
 * bottom sheet moved every time the keyboard did: the sheet opened at the
 * bottom, the keyboard rose over it, Safari panned the whole viewport to
 * reveal the focused field, and the sheet's own keyboard-following then
 * moved it again. Every one of those is a jump. This composer removes the
 * cause instead of chasing it:
 *
 *   • it fills the screen (a top-layer <dialog>), so there is no page behind
 *     it to scroll and nothing at the bottom for the keyboard to cover;
 *   • the field sits in the top third, where the keyboard never reaches, so
 *     Safari never needs to pan to reveal it — the frame does not move;
 *   • nothing here listens to the keyboard or resizes with it;
 *   • the page behind is locked while it is open, and put back exactly where
 *     it was when it closes.
 *
 * Type, pick who, send. When is today unless you say otherwise: "מחר" is one
 * tap, and 📅 opens a real calendar (Calendar) — the keyboard steps aside for
 * it. A time (the native wheel) and a note are one tap each, and absent until
 * asked for. Editing a task opens the same composer, filled, plus delete.
 */
export function Composer({
  open,
  onClose,
  task,
  defaultDate,
  me,
  partner,
  onDelete,
  onRate,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  task?: TaskView | null;
  defaultDate: CalendarDate;
  me: PartnerRef;
  partner: PartnerRef | null;
  onDelete?: (task: TaskView) => void;
  /** Open the rating sheet for this (finished) task: the clear way to change a rating. */
  onRate?: (task: TaskView) => void;
  /** Where focus goes back to when it closes (the + button). */
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const { pending, fieldErrors, formError, submit, clearOnInput, reset } = useSubmit();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [fieldHeight, setFieldHeight] = useState<number | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const savedScroll = useRef(0);
  const tomorrow = addDays(defaultDate, 1);

  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState(me.id);
  const [date, setDate] = useState<CalendarDate>(defaultDate);
  const [time, setTime] = useState<LocalTime | ''>('');
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [withTime, setWithTime] = useState(false);
  const [withNote, setWithNote] = useState(false);
  const [missingTitle, setMissingTitle] = useState(false);
  /** Photos picked in this visit, not uploaded yet (they need the task's id). */
  const [newPhotos, setNewPhotos] = useState<{ key: string; blob: Blob; url: string }[]>([]);
  /** Existing photos the person removed in this visit. */
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  /** The photo open full screen (its index), or null. */
  const [viewing, setViewing] = useState<number | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const toast = useToast();
  /** The whole save — the task, then its photos, then the list catching up. */
  const [saving, setSaving] = useState(false);
  const busy = pending || saving;

  // Fill in on each open (render-phase: no flash of the previous task).
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const identity = open ? (task?.id ?? 'new') : null;
  if (identity !== openedFor) {
    setOpenedFor(identity);
    if (open) {
      reset();
      setTitle(task?.title ?? '');
      setOwnerId(task?.ownerId ?? me.id);
      setDate(task?.taskDate ?? defaultDate);
      setTime(task?.dueTime ?? '');
      setNote(task?.note ?? '');
      setWithTime(Boolean(task?.dueTime));
      setWithNote(Boolean(task?.note));
      setPicking(false);
      setMissingTitle(false);
      setNewPhotos([]);
      setRemovedPhotos([]);
      setViewing(null);
      setSaving(false);
    }
  }
  if (open && !mounted) setMounted(true);
  if (!mounted && shown) setShown(false);
  const visible = open && shown;

  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 380);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  // Closing stays MODAL through the short exit fade. (Re-showing it non-modally
  // to let taps through made the browser drop the fade: the screen vanished in
  // one frame, which was the jump on leaving a task.) iOS ignores taps during a
  // dismissal too.
  useEffect(() => {
    if (open) return;
    // If Safari panned the page for the keyboard, put it back NOW — while the
    // composer still covers it — rather than after it has faded (a visible jump).
    if (Math.abs(window.scrollY - savedScroll.current) > 1) window.scrollTo(0, savedScroll.current);
  }, [open]);

  // Open: top layer, lock the page, focus the field in the same task as the tap.
  useLayoutEffect(() => {
    if (!mounted) return;
    const node = dialog.current;
    if (!node) return;
    // The keyboard-priming input holds focus at this point, so the way back is
    // named by the caller (the + button), or is whatever was focused (a row).
    restoreFocus.current =
      returnFocus?.current ??
      (document.activeElement instanceof HTMLElement && document.activeElement.tagName !== 'INPUT' ? document.activeElement : null);
    // No scroll lock: the composer is opaque and modal, so the page behind can
    // neither be seen nor touched — and toggling overflow on the root is what
    // made the list jump when the composer closed on a real iPhone.
    savedScroll.current = window.scrollY;
    if (!node.open) node.showModal();
    if (!task) titleRef.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      if (node.open) node.close();
      restoreFocus.current?.focus({ preventScroll: true });
    };
    // task is read once, at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // The mirror's height is the field's height (capped at 40% of the screen,
  // after which the field scrolls). A ResizeObserver hears both typing and
  // width changes, and fires once on observe.
  useLayoutEffect(() => {
    const node = mirror.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setFieldHeight(Math.min(node.offsetHeight, Math.round(window.innerHeight * 0.4))));
    observer.observe(node);
    return () => observer.disconnect();
  }, [mounted]);

  function close() {
    if (busy) return;
    titleRef.current?.blur();
    onClose();
  }

  async function save() {
    if (busy) return;
    if (title.trim() === '') {
      setMissingTitle(true);
      titleRef.current?.focus({ preventScroll: true });
      return;
    }
    setSaving(true);
    try {
      await saveAll();
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    // Every key the schema knows, in the shape it expects: the edit schema
    // needs the id (its absence once reached a person as "Invalid input").
    const body = {
      title,
      ownerId,
      taskDate: date,
      dueTime: withTime && time !== '' ? time : null,
      note: withNote && note.trim() !== '' ? note : null,
    };
    const result = task
      ? await submit(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          body: { ...body, id: task.id, version: task.version },
        })
      : await submit('/api/tasks', { method: 'POST', body });
    if (result === null) return;
    titleRef.current?.blur();
    // The photo follows the task (it needs the task's id): upload a new one,
    // or remove the old one. A failed upload keeps the task and says so.
    const taskId = (result as TaskView).id;
    try {
      for (const id of removedPhotos) {
        const response = await fetch(`/api/tasks/${taskId}/photos/${id}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(String(response.status));
      }
      for (const photo of newPhotos) {
        const response = await fetch(`/api/tasks/${taskId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': photo.blob.type || 'image/jpeg' },
          body: photo.blob,
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(String(response.status));
      }
    } catch {
      toast.show(copy.tasks.photoFailed, 'error');
    }
    for (const photo of newPhotos) URL.revokeObjectURL(photo.url);
    router.refresh();
    onClose();
  }

  async function pickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) toast.show(copy.tasks.photosFull(MAX_PHOTOS), 'error');
    const added: { key: string; blob: Blob; url: string }[] = [];
    for (const file of chosen) {
      try {
        const blob = await shrinkPhoto(file);
        added.push({
          key: `${Date.now()}-${added.length}-${file.name}`,
          blob,
          url: URL.createObjectURL(blob),
        });
      } catch {
        toast.show(copy.tasks.photoNotImage, 'error');
      }
    }
    if (added.length > 0) setNewPhotos((previous) => [...previous, ...added]);
  }

  if (!mounted) return null;

  const people = partner ? [me, partner] : [me];
  const custom = date !== defaultDate && date !== tomorrow;
  const titleError = missingTitle ? copy.tasks.titleMissing : fieldErrors.title;
  // Every photo on screen, in order: the saved ones (minus any removed now),
  // then the ones picked in this visit.
  const photos: { key: string; src: string; saved?: string }[] = [
    ...(task?.photos ?? [])
      .filter((photo) => !removedPhotos.includes(photo.id))
      .map((photo) => ({
        key: photo.id,
        src: `/api/tasks/${task!.id}/photos/${photo.id}?v=${photo.version}`,
        saved: photo.id,
      })),
    ...newPhotos.map((photo) => ({ key: photo.key, src: photo.url })),
  ];
  const photoAlt = (index: number) =>
    `${copy.tasks.photoAlt(title || copy.tasks.titleLabel)} · ${copy.tasks.photoOf(index + 1, photos.length)}`;

  const chip = (on: boolean) =>
    cx(
      'tap-quiet press inline-flex min-h-11 items-center gap-2 rounded-chip px-4 text-body transition-[background-color,color,box-shadow] duration-200',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      on
        ? 'bg-surface font-semibold text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]'
        : 'text-ink-muted shadow-[inset_0_0_0_1px_var(--color-rule)]',
    );

  return (
    <dialog
      ref={dialog}
      aria-label={task ? copy.tasks.editTitle : copy.tasks.addTitle}
      data-testid="composer"
      data-shown={visible}
      data-kind={task ? 'push' : 'rise'}
      onCancel={(event) => {
        event.preventDefault();
        // Only the dialog's own cancel (Escape) closes it. A file input fires
        // a bubbling `cancel` when its picker is dismissed; that is not a request
        // to leave this screen.
        if (event.target !== event.currentTarget) return;
        close();
      }}
      className="composer"
    >
      <form
        method="post"
        onInput={(event) => {
          clearOnInput(event);
          setMissingTitle(false);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="composer-body"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            aria-label={copy.common.close}
            className="tap-quiet press -ms-2 grid size-11 place-items-center rounded-full text-ink-muted focus-visible:outline-2 focus-visible:outline-focus"
          >
            <X aria-hidden="true" size={24} />
          </button>
          {task && onDelete && task.permissions.delete && (
            <button
              type="button"
              onClick={() => onDelete(task)}
              disabled={busy}
              className="tap-quiet press min-h-11 rounded-chip px-3 text-body text-danger-text focus-visible:outline-2 focus-visible:outline-focus"
            >
              {copy.tasks.deleteAction}
            </button>
          )}
        </div>

        {formError && (
          <p role="alert" className="mt-2 text-body font-medium text-danger-text">
            {formError}
          </p>
        )}

        {/* The sentence and send. */}
        <div className="mt-3 flex items-end gap-2">
          <label className="sr-only" htmlFor="task-title">
            {copy.tasks.titleLabel}
          </label>
          {/* The field grows with the sentence. A hidden mirror with the same
              text and metrics says how tall it needs to be; the field eases to
              that height (never collapsing to measure first), so a long task
              opens line by line with nothing jumping. */}
          <div className="relative min-w-0 flex-1">
            <div ref={mirror} aria-hidden="true" className="composer-field composer-mirror">
              {(title || copy.tasks.titlePlaceholder) + '\u200b'}
            </div>
            <textarea
              id="task-title"
              ref={titleRef}
              name="title"
              rows={1}
              value={title}
              onChange={(event) => setTitle(event.target.value.replace(/\n/g, ' '))}
              onKeyDown={(event) => {
                // Enter sends (the keyboard says "send"); a task is one sentence.
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              onFocus={() => setPicking(false)}
              placeholder={copy.tasks.titlePlaceholder}
              autoComplete="off"
              enterKeyHint="send"
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? 'task-title-error' : undefined}
              className="composer-field composer-grow block w-full"
              style={fieldHeight ? { height: fieldHeight } : undefined}
            />
          </div>
        </div>
        <p
          id="task-title-error"
          role={titleError ? 'alert' : undefined}
          className="mt-1.5 h-5 ps-2 text-label font-medium text-danger-text"
        >
          {titleError}
        </p>

        {/* Who. */}
        <fieldset className="mt-2 flex flex-wrap gap-2">
          <legend className="sr-only">{copy.tasks.ownerLabel}</legend>
          {people.map((person) => {
            const checked = ownerId === person.id;
            return (
              <label
                key={person.id}
                className={cx(
                  chip(checked),
                  'ps-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                )}
              >
                <input
                  type="radio"
                  name="ownerId"
                  value={person.id}
                  checked={checked}
                  onChange={() => setOwnerId(person.id)}
                  className="sr-only"
                />
                <PartnerAvatar person={person} size={1.75} />
                {person.id === me.id ? copy.common.me : person.name.split(' ')[0]}
              </label>
            );
          })}
        </fieldset>

        {/* When — and the two extras. */}
        <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label={copy.tasks.dateLabel}>
          <button
            type="button"
            aria-pressed={date === defaultDate}
            onClick={() => {
              setDate(defaultDate);
              setPicking(false);
            }}
            className={chip(date === defaultDate)}
          >
            {copy.common.today}
          </button>
          <button
            type="button"
            aria-pressed={date === tomorrow}
            onClick={() => {
              setDate(tomorrow);
              setPicking(false);
            }}
            className={chip(date === tomorrow)}
          >
            {copy.tasks.tomorrow}
          </button>
          <button
            type="button"
            aria-pressed={custom}
            aria-expanded={picking}
            aria-label={custom ? `${copy.tasks.chooseDate}: ${shortDay.format(new Date(`${date}T12:00:00Z`))}` : copy.tasks.chooseDate}
            onClick={() => {
              titleRef.current?.blur();
              setPicking((value) => !value);
            }}
            className={chip(custom || picking)}
          >
            <CalendarDays aria-hidden="true" size={18} />
            {custom && <span>{shortDay.format(new Date(`${date}T12:00:00Z`))}</span>}
          </button>
        </div>

        {/* The one action, impossible to miss: full width, in both lights. */}
        <button
          type="submit"
          aria-busy={busy || undefined}
          className="create-button tap-quiet mt-4 flex h-14 w-full items-center justify-center rounded-full text-row font-bold text-on-partner focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <BusyLabel busy={busy} onFill>
            {!task && <Plus aria-hidden="true" size={20} strokeWidth={2.6} />}
            {task ? copy.common.save : copy.common.add}
          </BusyLabel>
          {busy && <span className="sr-only">{task ? copy.tasks.saving : copy.tasks.adding}</span>}
        </button>

        {picking ? (
          <div className="composer-panel mt-3">
            <Calendar
              value={date}
              today={defaultDate}
              onPick={(picked) => {
                setDate(picked);
                setPicking(false);
              }}
            />
          </div>
        ) : (
          <div className="mt-2.5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {/* The time: the chip IS the native time field (laid over it,
                  invisible), so the first tap opens the wheel — a button that
                  first had to turn into a field took two taps. */}
              <span className={cx(chip(withTime && time !== ''), 'relative', withTime && time !== '' && 'pe-1.5')}>
                <Clock aria-hidden="true" size={18} />
                <span aria-hidden="true" className="tabular-nums">
                  {withTime && time !== '' ? copy.tasks.untilTime(time) : copy.tasks.timeLabel}
                </span>
                <input
                  type="time"
                  name="dueTime"
                  aria-label={copy.tasks.timeLabel}
                  value={time}
                  onChange={(event) => {
                    const next = event.target.value as LocalTime | '';
                    setTime(next);
                    setWithTime(next !== '');
                  }}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  dir="ltr"
                />
                {withTime && time !== '' && (
                  <button
                    type="button"
                    aria-label={copy.tasks.removeTime}
                    onClick={() => {
                      setWithTime(false);
                      setTime('');
                    }}
                    className="relative z-10 grid size-8 place-items-center rounded-full text-ink-subtle"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                )}
              </span>
              {!withNote && (
                <button type="button" onClick={() => setWithNote(true)} className={chip(false)}>
                  {copy.tasks.addNote}
                </button>
              )}
              {photos.length === 0 && (
                <button type="button" onClick={() => photoInput.current?.click()} className={chip(false)}>
                  <Camera aria-hidden="true" size={18} />
                  {copy.tasks.addPhoto}
                </button>
              )}
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-label={copy.tasks.addPhoto}
                data-testid="photo-input"
                onChange={(event) => {
                  void pickPhotos(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>

            {photos.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label={copy.tasks.photoCount(photos.length)}>
                {photos.map((photo, index) => (
                  <li key={photo.key} className="relative">
                    <button
                      type="button"
                      onClick={() => setViewing(index)}
                      aria-label={copy.tasks.openPhoto}
                      className="tap-quiet press block size-[4.5rem] overflow-hidden rounded-[1rem] shadow-[var(--brand-glass-edge),var(--brand-shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a private, versioned API image, not a static asset */}
                      <img src={photo.src} alt={photoAlt(index)} className="size-full object-cover" />
                    </button>
                    <button
                      type="button"
                      aria-label={copy.tasks.removePhoto}
                      onClick={() => {
                        if (photo.saved) {
                          setRemovedPhotos((previous) => [...previous, photo.saved!]);
                        } else {
                          setNewPhotos((previous) => {
                            const gone = previous.find((item) => item.key === photo.key);
                            if (gone) URL.revokeObjectURL(gone.url);
                            return previous.filter((item) => item.key !== photo.key);
                          });
                        }
                      }}
                      className="tap-quiet press absolute -top-2 -start-2 grid size-7 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-surface)] shadow-[var(--brand-shadow-card)]"
                    >
                      <X aria-hidden="true" size={14} strokeWidth={2.6} />
                    </button>
                  </li>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <li>
                    <button
                      type="button"
                      onClick={() => photoInput.current?.click()}
                      aria-label={copy.tasks.addPhoto}
                      className="tap-quiet press grid size-[4.5rem] place-items-center rounded-[1rem] text-ink-muted shadow-[inset_0_0_0_1.5px_var(--color-rule-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <Plus aria-hidden="true" size={22} />
                    </button>
                  </li>
                )}
              </ul>
            )}

            {task && task.state === 'COMPLETED' && task.permissions.rate && onRate && (
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-[1rem] bg-[var(--brand-glass-strong)] px-4 py-2 shadow-[var(--brand-glass-edge)]">
                <span className="flex items-center gap-2 text-body text-ink">
                  {task.rating ? <RatingBadge value={task.rating.value} /> : copy.taskRating.notRatedYet}
                </span>
                <button
                  type="button"
                  onClick={() => onRate(task)}
                  className="tap-quiet press min-h-10 rounded-chip px-3 text-body font-semibold text-accent-text"
                >
                  {task.rating ? copy.taskRating.changeRating : copy.taskRating.rateShort}
                </button>
              </div>
            )}
            {fieldErrors.dueTime && <p className="text-label text-danger-text">{fieldErrors.dueTime}</p>}
            {withNote && (
              <FormField label={copy.tasks.noteLabel} name="note" error={fieldErrors.note}>
                {(props) => (
                  <GrowingTextarea
                    {...props}
                    name="note"
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className={controlClasses(Boolean(fieldErrors.note), 'leading-relaxed [overflow-wrap:anywhere]')}
                  />
                )}
              </FormField>
            )}
          </div>
        )}
      </form>
      {photos.length > 0 && (
        <PhotoViewer
          photos={photos.map((photo, index) => ({
            key: photo.key,
            src: photo.src,
            alt: photoAlt(index),
          }))}
          index={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </dialog>
  );
}
