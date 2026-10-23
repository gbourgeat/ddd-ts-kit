import { aspectOrigins } from './aspect-origins';
import type { Aspect } from './aspect';
import { compose } from './compose';
import { defineAspect } from './define-aspect';
import type { Selector } from './selector';

/**
 * The aspects, for the methods the selector picks only:
 * `when(allOf(forKinds('external'), forMethods('find*')), cached(...))`.
 */
export function when(selector: Selector, ...aspects: readonly Aspect[]): Aspect {
  return compose(...aspects.map((aspect) => selecting(selector, aspect)));
}

function selecting(selector: Selector, aspect: Aspect): Aspect {
  const origin = aspectOrigins.get(aspect);

  if (origin === undefined) {
    throw new TypeError(
      'when() selects methods of aspects made by defineAspect, compose or when: this function was not, so filter inside it',
    );
  }

  if ('parts' in origin) {
    return when(selector, ...origin.parts);
  }

  return defineAspect((joinPoint) => (selector(joinPoint) ? origin.advise(joinPoint) : undefined));
}
