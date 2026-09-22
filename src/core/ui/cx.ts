/** Join class names, skipping falsy values. Deliberately tiny: no merge magic. */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
