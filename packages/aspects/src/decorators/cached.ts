import { cachedAdvice, type CachedOptions } from '../cached/cached.js';
import type { AsyncMethodDecorator } from './async-method-decorator.js';
import { decoratorOf } from './decorator-of.js';

/** See `cached`. The cache comes from the aspect runtime unless given. */
export function Cached(options: CachedOptions): AsyncMethodDecorator {
  return decoratorOf(cachedAdvice(options));
}
