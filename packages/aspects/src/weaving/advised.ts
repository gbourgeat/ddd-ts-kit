import type { AdviceFactory } from '../aspect/advice-factory';
import type { JoinPoint } from '../aspect/join-point';
import { knownAsync } from './known-async';
import type { Method } from './method';
import { named } from './named';

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
