import type { JoinPoint } from './types.js';

/** Whether a stateful aspect keeps one state per method (the default) or one per instance. */
export type StateScope = 'method' | 'instance';

/** Answers the state of a join point: a new one per method, or the one of its instance. */
export function stateFor<State>(
  scope: StateScope | undefined,
  create: (joinPoint: JoinPoint) => State,
): (joinPoint: JoinPoint) => State {
  if (scope !== 'instance') return create;
  const states = new WeakMap<object, State>();
  return (joinPoint) => {
    const existing = states.get(joinPoint.instance);
    if (existing !== undefined) return existing;
    const state = create(joinPoint);
    states.set(joinPoint.instance, state);
    return state;
  };
}
