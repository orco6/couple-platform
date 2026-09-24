import { cx } from '@/core/ui/cx';
import type { PartnerRef } from '@/domain/partners';

/**
 * A partner, as a face: their photo in a circle, ringed in their colour (blue
 * for A, pink for B). Without a photo it is their light, as before. The name
 * is said elsewhere (the image is decorative), so it is hidden from screen
 * readers.
 */
export function PartnerAvatar({
  person,
  size,
  className,
}: {
  person: Pick<PartnerRef, 'id' | 'side' | 'photo'>;
  /** Diameter in rem. */
  size: number;
  className?: string;
}) {
  const style = { width: `${size}rem`, height: `${size}rem` };
  if (!person.photo) {
    return <span aria-hidden="true" style={style} className={cx(person.side === 'a' ? 'light-a' : 'light-b', 'shrink-0', className)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a private, versioned API image
    <img
      src={`/api/profile-photos/${person.id}?v=${person.photo}`}
      alt=""
      aria-hidden="true"
      style={style}
      className={cx('avatar shrink-0', person.side === 'a' ? 'avatar--a' : 'avatar--b', className)}
    />
  );
}
