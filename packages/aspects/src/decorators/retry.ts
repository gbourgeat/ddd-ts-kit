import { retryAdvice, type RetryOptions } from '../retry/retry';
import type { AsyncMethodDecorator } from './async-method-decorator';
import { decoratorOf } from './decorator-of';

/** For an adapter whose retry policy is part of its definition. See `retry`. */
export function Retry(options: RetryOptions): AsyncMethodDecorator {
  return decoratorOf(retryAdvice(options));
}
