import type { JoinPoint } from '../aspect/join-point';
import type { StateScope } from './state-scope';

/** Answers the state of a join point: a new one per method, or the one of its instance. */
export function stateFor<State>(
  scope: StateScope | undefined,
  create: (joinPoint: JoinPoint) => State,
): (joinPoint: JoinPoint) => State {
  if (scope !== 'instance') {
    return create;
  }

  const states = new WeakMap<object, State>();

  return (joinPoint) => {
    const existing = states.get(joinPoint.instance);

    if (existing !== undefined) {
      return existing;
    }

    const state = create(joinPoint);

    states.set(joinPoint.instance, state);

    return state;
  };
}
