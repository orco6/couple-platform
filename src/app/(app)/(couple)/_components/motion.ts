/**
 * The product's motion vocabulary — three springs and two curves, so every
 * moving thing on these screens belongs to one family.
 *
 *   snappy  a control answering a finger: a mark filling, a knob landing.
 *   settle  something finding its new place: a row moving down the list.
 *   soft    an arrival worth noticing: the reveal, a recap coming in.
 *
 * Springs rather than durations wherever a finger started the motion: a spring
 * picks up from wherever the element is, so a second tap mid-animation never
 * snaps. Curves for fades, where there is no velocity to carry.
 */
export const spring = {
  snappy: { type: 'spring', stiffness: 560, damping: 34, mass: 0.7 },
  settle: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
  soft: { type: 'spring', stiffness: 170, damping: 23, mass: 1 },
} as const;

export const curve = {
  out: [0.22, 1, 0.36, 1],
  in: [0.4, 0, 1, 1],
} as const;

/** Under reduced motion: a short fade, no travel. */
export const reducedFade = { duration: 0.12 } as const;

/** One short tick on phones that support it. iOS Safari ignores it, which is
 *  why it is never the only feedback. */
export function tick(ms = 8) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(ms);
  } catch {
    // A blocked vibration is not an error.
  }
}
