/**
 * The value actually in a submitted field.
 *
 * Controlled inputs normally mirror the DOM, but two real situations leave the
 * DOM holding text React never saw:
 *
 *   1. Password managers and browser autofill that set the value without firing
 *      an input event React listens to.
 *   2. Typing before hydration: the markup is interactive before the handlers
 *      attach.
 *
 * Verified in this foundation: a sign-in form with both fields visibly filled
 * that way answered "fill in username and password". Credential forms (and any
 * form likely to be autofilled) read their values here at submit time; the
 * React state is only the fallback.
 */
export function submittedValue(form: HTMLFormElement, name: string, fallback: string): string {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value;
  }
  return fallback;
}
