/**
 * Lifecycle — explicit state machines for business records.
 *
 * There is no universal status enum. Each entity defines its own states and
 * the exact transitions allowed between them, with an optional permission and
 * an optional "reason required" per transition. Anything not listed is refused.
 *
 *   const taskLifecycle = defineLifecycle({
 *     initial: 'OPEN',
 *     states: { OPEN: { label: 'פתוחה' }, DONE: { label: 'בוצעה', terminal: true } },
 *     transitions: [{ name: 'complete', from: ['OPEN'], to: 'DONE' }],
 *   });
 *   taskLifecycle.assertTransition(task.status, 'DONE', { can });
 *
 * Side effects of a transition (setting completedOn, writing audit) belong to
 * the domain service that calls this; this module only answers "is it allowed".
 */

import { copy } from '@/core/copy';
import { errors } from '@/core/errors/errors';

export interface StateDefinition {
  label: string;
  /** No transitions out, except those explicitly listed (e.g. reopen). */
  terminal?: boolean;
  /** Visual tone for StatusBadge. */
  tone?: 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'muted';
}

export interface TransitionDefinition<S extends string, P extends string> {
  name: string;
  from: readonly S[];
  to: S;
  /** Permission the actor needs, on top of whatever access the record requires. */
  permission?: P;
  requiresReason?: boolean;
  /** Button label for this action. */
  label?: string;
}

export interface LifecycleDefinition<S extends string, P extends string> {
  initial: S;
  states: Record<S, StateDefinition>;
  transitions: readonly TransitionDefinition<S, P>[];
}

export interface TransitionContext<P extends string> {
  can?: (permission: P) => boolean;
  reason?: string | null;
}

export function defineLifecycle<const S extends string, const P extends string = string>(
  definition: LifecycleDefinition<S, P>,
) {
  const stateKeys = Object.keys(definition.states) as S[];

  for (const transition of definition.transitions) {
    for (const state of [...transition.from, transition.to]) {
      if (!stateKeys.includes(state)) {
        throw new Error(`Lifecycle transition "${transition.name}" references unknown state "${state}"`);
      }
    }
  }

  function isState(value: unknown): value is S {
    return typeof value === 'string' && (stateKeys as string[]).includes(value);
  }

  function findTransition(from: S, to: S) {
    return definition.transitions.find((t) => t.to === to && t.from.includes(from));
  }

  function available(from: S, context: TransitionContext<P> = {}) {
    return definition.transitions.filter(
      (t) => t.from.includes(from) && (!t.permission || !context.can || context.can(t.permission)),
    );
  }

  function assertTransition(from: S, to: S, context: TransitionContext<P> = {}) {
    const transition = findTransition(from, to);
    if (!transition) {
      throw errors.businessRule(
        'INVALID_TRANSITION',
        copy.lifecycle.invalidTransition(definition.states[from].label, definition.states[to].label),
      );
    }
    if (transition.permission && !(context.can?.(transition.permission) ?? false)) {
      throw errors.authorization();
    }
    if (transition.requiresReason && !context.reason?.trim()) {
      throw errors.validation(copy.lifecycle.reasonRequired, { reason: copy.periods.reasonRequired });
    }
    return transition;
  }

  return {
    definition,
    states: stateKeys,
    initial: definition.initial,
    isState,
    label: (state: S) => definition.states[state].label,
    tone: (state: S) => definition.states[state].tone ?? 'neutral',
    isTerminal: (state: S) => definition.states[state].terminal === true,
    canTransition: (from: S, to: S) => Boolean(findTransition(from, to)),
    available,
    assertTransition,
  };
}

export type Lifecycle<S extends string, P extends string = string> = ReturnType<typeof defineLifecycle<S, P>>;
