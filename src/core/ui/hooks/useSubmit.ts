'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiRequest, newIdempotencyKey, type ApiRequestOptions } from '@/core/http/client';
import { copy } from '@/core/copy';

/**
 * Form submission state: pending, field errors, a form-level error, and
 * duplicate-submit protection on two levels —
 *
 *   1. While a submit is in flight, further submits are ignored (ref, not
 *      state, so a double-click inside one render is caught too).
 *   2. Every logical submit carries an Idempotency-Key. A retry after a
 *      failure that never reached the server reuses it; the server replays the
 *      stored result instead of creating a second record.
 *
 * The key rotates after a success or after a server-side validation error (the
 * person will change the data, so it is a new submission).
 *
 * Field errors are never silent: after they render, focus moves to the first
 * invalid control. If the server rejected a field this form does not show (no
 * control is marked invalid — e.g. an unknown field from an outdated client),
 * the messages are shown as the form-level error instead.
 */

export interface SubmitState {
  pending: boolean;
  fieldErrors: Record<string, string>;
  formError: string | null;
}

export function useSubmit() {
  const inFlight = useRef(false);
  const keyRef = useRef<string | null>(null);
  const [state, setState] = useState<SubmitState>({ pending: false, fieldErrors: {}, formError: null });
  const surfaceErrors = useRef(false);

  useEffect(() => {
    if (!surfaceErrors.current) return;
    surfaceErrors.current = false;
    const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    const messages = Object.values(state.fieldErrors);
    // Runs once per failed submit, only when no control can display the errors.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (messages.length > 0) setState((previous) => ({ ...previous, formError: messages.join(' · ') }));
  }, [state.fieldErrors]);

  const submit = useCallback(async <T>(url: string, options: Omit<ApiRequestOptions, 'idempotencyKey'>): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    keyRef.current ??= newIdempotencyKey();
    setState({ pending: true, fieldErrors: {}, formError: null });

    try {
      const result = await apiRequest<T>(url, { ...options, idempotencyKey: keyRef.current });
      keyRef.current = null;
      setState({ pending: false, fieldErrors: {}, formError: null });
      return result;
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN', 'unexpected', copy.errors.unexpected);
      if (apiError.status >= 400 && apiError.status < 500 && apiError.code !== 'DUPLICATE_REQUEST') {
        keyRef.current = null;
      }
      const hasFieldErrors = Object.keys(apiError.fieldErrors).length > 0;
      surfaceErrors.current = hasFieldErrors;
      setState({
        pending: false,
        fieldErrors: apiError.fieldErrors,
        formError: hasFieldErrors && apiError.code === 'VALIDATION_FAILED' ? null : apiError.userMessage,
      });
      return null;
    } finally {
      inFlight.current = false;
    }
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setState((previous) =>
      previous.fieldErrors[field]
        ? { ...previous, fieldErrors: Object.fromEntries(Object.entries(previous.fieldErrors).filter(([key]) => key !== field)) }
        : previous,
    );
  }, []);

  const reset = useCallback(() => {
    keyRef.current = null;
    setState({ pending: false, fieldErrors: {}, formError: null });
  }, []);

  /**
   * Put on the <form> (or the element wrapping the fields): editing a field removes that field's server error at once
   * (fields are matched by `name`, which FormField passes to its control). The
   * error came from the last submit; once the person changes the value it is no
   * longer about what is on screen. Form-level errors stay until the next submit.
   */
  const clearOnInput = useCallback(
    (event: React.FormEvent<HTMLElement>) => {
      const name = (event.target as { name?: unknown }).name;
      if (typeof name === 'string' && name) clearFieldError(name);
    },
    [clearFieldError],
  );

  return { ...state, submit, clearFieldError, clearOnInput, reset };
}
