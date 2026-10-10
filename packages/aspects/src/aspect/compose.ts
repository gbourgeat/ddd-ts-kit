import { aspectOrigins } from './aspect-origins.js';
import type { Aspect } from './aspect.js';

/**
 * One aspect out of several, the first outermost: `compose(retry(...), timeout(2000))` bounds
 * each attempt, the other order bounds them all together.
 */
export function compose(...aspects: readonly Aspect[]): Aspect {
  const composed: Aspect = (instance, info = {}) => aspects.reduceRight((wrapped, aspect) => aspect(wrapped, info), instance);

  aspectOrigins.set(composed, { parts: aspects });

  return composed;
}
