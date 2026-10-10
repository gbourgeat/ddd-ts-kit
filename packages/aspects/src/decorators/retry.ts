import { retryAdvice, type RetryOptions } from '../retry/retry.js';
import type { AsyncMethodDecorator } from './async-method-decorator.js';
import { decoratorOf } from './decorator-of.js';

/** For an adapter whose retry policy is part of its definition. See `retry`. */
export function Retry(options: RetryOptions): AsyncMethodDecorator {
  return decoratorOf(retryAdvice(options));
}
