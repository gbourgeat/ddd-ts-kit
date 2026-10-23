import { timeoutAdvice, type TimeoutOptions } from '../timeout/timeout';
import type { AsyncMethodDecorator } from './async-method-decorator';
import { decoratorOf } from './decorator-of';

/** See `timeout`. */
export function Timeout(timeoutMs: number, options?: TimeoutOptions): AsyncMethodDecorator {
  return decoratorOf(timeoutAdvice(timeoutMs, options));
}
