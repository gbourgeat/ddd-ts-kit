import { timeoutAdvice, type TimeoutOptions } from '../timeout/timeout.js';
import type { AsyncMethodDecorator } from './async-method-decorator.js';
import { decoratorOf } from './decorator-of.js';

/** See `timeout`. */
export function Timeout(timeoutMs: number, options?: TimeoutOptions): AsyncMethodDecorator {
  return decoratorOf(timeoutAdvice(timeoutMs, options));
}
