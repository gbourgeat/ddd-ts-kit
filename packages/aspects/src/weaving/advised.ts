import type { AdviceFactory } from '../aspect/advice-factory.js';
import type { JoinPoint } from '../aspect/join-point.js';
import { knownAsync } from './known-async.js';
import type { Method } from './method.js';
import { named } from './named.js';

/** The method inside the advice built for its join point, `undefined` when the factory leaves it alone. */
export function advised(original: Method, joinPoint: JoinPoint, advise: AdviceFactory): Method | undefined {
  const advice = advise(joinPoint);

  if (advice === undefined) {
    return undefined;
  }

  // Async so that an advice failing before its first await rejects the call instead of throwing.
  const wrapper: Method = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
    return advice({
      args,
      proceed: async (next = args) => original.apply(this, [...next]),
    });
  };

  knownAsync.add(wrapper);

  return named(wrapper, original);
}
