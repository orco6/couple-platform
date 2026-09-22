/**
 * Motion tokens for code that must wait for a transition (overlay unmount).
 * Source of truth for values is foundation.css; tests/unit/motion-tokens.test.ts
 * fails if the two drift apart.
 */
export const motion = {
  sheetEnterMs: 340,
  sheetExitMs: 240,
  backdropMs: 200,
  dialogEnterMs: 220,
  dialogExitMs: 160,
  disclosureEnterMs: 260,
  disclosureExitMs: 200,
  feedbackMs: 140,
  reducedMs: 120,
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
