import { adviseMethods } from '../weaving/advise-methods';
import type { AdviceFactory } from './advice-factory';
import { aspectOrigins } from './aspect-origins';
import type { Aspect } from './aspect';

/** Makes an aspect out of an advice factory. Every aspect of this package is made this way. */
export function defineAspect(advise: AdviceFactory): Aspect {
  const applied = new WeakSet<object>();

  const aspect: Aspect = (instance, info = {}) => {
    if (applied.has(instance)) {
      return instance;
    }

    const result = adviseMethods(instance, info, advise);

    applied.add(result);

    return result;
  };

  aspectOrigins.set(aspect, { advise });

  return aspect;
}
