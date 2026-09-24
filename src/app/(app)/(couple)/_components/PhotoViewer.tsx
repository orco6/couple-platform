'use client';

import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { copy } from '@/domain/copy';

/**
 * A task's photos, full screen, as in Photos: black around them, the whole
 * image visible, swipe sideways between them (native scroll snapping — the
 * finger drives it), a counter, a close button in reach. It opens on the
 * photo that was tapped, growing in from slightly smaller (never from zero)
 * and fading out. Its own top-layer <dialog>, above the composer that opened it.
 */
export function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: { key: string; src: string; alt: string }[];
  /** The photo to open on; null when closed. */
  index: number | null;
  onClose: () => void;
}) {
  const open = index !== null;
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [current, setCurrent] = useState(index ?? 0);
  if (open && !mounted) setMounted(true);
  if (!mounted && shown) setShown(false);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 240);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.showModal();
    node.scrollTop = 0;
    // Land on the tapped photo before the first paint.
    if (track.current) track.current.scrollLeft = (index ?? 0) * track.current.clientWidth;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      if (node.open) node.close();
    };
    // index is read at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  return (
    <dialog
      ref={dialog}
      aria-label={photos[current]?.alt ?? copy.tasks.openPhoto}
      data-shown={open && shown}
      className="photo-viewer"
      onCancel={(event) => {
        event.preventDefault();
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={track}
        dir="ltr"
        className="photo-track"
        onScroll={(event) => {
          const node = event.currentTarget;
          setCurrent(Math.round(node.scrollLeft / Math.max(1, node.clientWidth)));
        }}
        onClick={(event) => {
          // A tap on the black around a photo closes, as in Photos.
          if (!(event.target instanceof HTMLImageElement)) onClose();
        }}
      >
        {photos.map((photo) => (
          <div key={photo.key} className="photo-slide">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private, versioned API image */}
            <img src={photo.src} alt={photo.alt} className="photo-viewer-image" />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <p className="photo-counter" aria-live="polite">
          {copy.tasks.photoOf(current + 1, photos.length)}
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label={copy.common.close}
        className="tap-quiet press absolute top-[max(0.75rem,env(safe-area-inset-top))] start-3 grid size-11 place-items-center rounded-full bg-black/50 text-white focus-visible:outline-2 focus-visible:outline-white"
      >
        <X aria-hidden="true" size={22} />
      </button>
    </dialog>
  );
}
