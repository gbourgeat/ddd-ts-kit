import type { EventSource } from './event-source';
import { isPromiseLike } from './is-promise-like';
import type { Recorded } from './recorded';

/** Runs the action on the aggregate and records its events, the ones of the arrangement discarded. */
export function act<A extends EventSource>(
  aggregate: A,
  action: (aggregate: A) => unknown,
): Recorded<A> | Promise<Recorded<A>> {
  aggregate.pullEvents();

  const record = (thrown: Recorded<A>['thrown']): Recorded<A> => ({
    aggregate,
    events: aggregate.pullEvents(),
    thrown,
  });

  try {
    const result = action(aggregate);

    if (isPromiseLike(result)) {
      return Promise.resolve(result).then(
        () => record(undefined),
        (error: unknown) => record({ error }),
      );
    }

    return record(undefined);
  } catch (error) {
    return record({ error });
  }
}
