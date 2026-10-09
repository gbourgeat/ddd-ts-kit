import type { AdviceFactory, Aspect, Selector } from './types.js';
import { adviseMethods } from './weave.js';

const factories = new WeakMap<Aspect, AdviceFactory>();
const compositions = new WeakMap<Aspect, readonly Aspect[]>();

/** Makes an aspect out of an advice factory. Every aspect of this package is made this way. */
export function defineAspect(advise: AdviceFactory): Aspect {
  const applied = new WeakSet<object>();
  const aspect: Aspect = (instance, info = {}) => {
    if (applied.has(instance)) return instance;
    const result = adviseMethods(instance, info, advise);
    applied.add(result);
    return result;
  };
  factories.set(aspect, advise);
  return aspect;
}

/**
 * One aspect out of several, the first outermost: `compose(retry(...), timeout(2000))` bounds
 * each attempt, the other order bounds them all together.
 */
export function compose(...aspects: readonly Aspect[]): Aspect {
  const composed: Aspect = (instance, info = {}) =>
    aspects.reduceRight((wrapped, aspect) => aspect(wrapped, info), instance);
  compositions.set(composed, aspects);
  return composed;
}

/**
 * The aspects, for the methods the selector picks only:
 * `when(allOf(forKinds('external'), forMethods('find*')), cached(...))`.
 */
export function when(selector: Selector, ...aspects: readonly Aspect[]): Aspect {
  return compose(...aspects.map((aspect) => selecting(selector, aspect)));
}

function selecting(selector: Selector, aspect: Aspect): Aspect {
  const parts = compositions.get(aspect);
  if (parts !== undefined) return when(selector, ...parts);
  const advise = factories.get(aspect);
  if (advise === undefined) {
    throw new TypeError(
      'when() selects methods of aspects made by defineAspect, compose or when: this function was not, so filter inside it',
    );
  }
  return defineAspect((joinPoint) => (selector(joinPoint) ? advise(joinPoint) : undefined));
}
