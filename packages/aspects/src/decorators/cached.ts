import { cachedAdvice, type CachedOptions } from '../cached/cached';
import type { AsyncMethodDecorator } from './async-method-decorator';
import { decoratorOf } from './decorator-of';

/** See `cached`. The cache comes from the aspect runtime unless given. */
export function Cached(options: CachedOptions): AsyncMethodDecorator {
  return decoratorOf(cachedAdvice(options));
}
