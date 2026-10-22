import type { AdviceFactory } from '../aspect/advice-factory';
import { advised } from './advised';
import { isWrappable } from './is-wrappable';
import { knownAsync } from './known-async';
import type { Method } from './method';
import { named } from './named';
import { siteOf } from './site-of';

/**
 * The same advice for a method decorated in the legacy mode, which has no initializer to run
 * at construction: the answer replaces the method on the prototype, and builds the advice of
 * each instance at its first call. State is kept per instance and per method, as above.
 */
export function advisePrototypeMethod(name: string, original: unknown, advise: AdviceFactory): unknown {
  if (!isWrappable(original)) {
    return original;
  }

  const wrappers = new WeakMap<object, Method>();

  const dispatcher: Method = function (this: unknown, ...args: unknown[]): unknown {
    if (typeof this !== 'object' || this === null) {
      return original.apply(this, args);
    }

    const wrapper = wrappers.get(this) ?? adviceOf(this, original, { name, advise });

    wrappers.set(this, wrapper);

    return wrapper.apply(this, args);
  };

  knownAsync.add(dispatcher);

  return named(dispatcher, original);
}

interface Advising {
  readonly name: string;
  readonly advise: AdviceFactory;
}

function adviceOf(instance: object, original: Method, { name, advise }: Advising): Method {
  return advised(original, { ...siteOf(instance, {}), method: name, arity: original.length }, advise) ?? original;
}
