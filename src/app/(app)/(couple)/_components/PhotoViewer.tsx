'use client';

import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { copy } from '@/domain/copy';

/**
 * A task's photo, full screen: black around it, the whole image visible,
 * a close button in reach. It grows in from slightly smaller (never from
 * zero) and fades out; a tap anywhere closes it, as in Photos. Its own
 * top-layer <dialog>, so it sits above the composer that opened it.
 */
export function PhotoViewer({ src, alt, open, onClose }: { src: string; alt: string; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
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
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      if (node.open) node.close();
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <dialog
      ref={dialog}
      aria-label={alt}
      data-shown={open && shown}
      className="photo-viewer"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a private, versioned API image */}
      <img src={src} alt={alt} className="photo-viewer-image" />
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
