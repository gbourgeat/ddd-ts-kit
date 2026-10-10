import { timedAdvice, type TimedOptions } from '../observability/timed.js';
import type { AsyncMethodDecorator } from './async-method-decorator.js';
import { decoratorOf } from './decorator-of.js';

/** See `timed`. The metrics come from the aspect runtime unless given. */
export function Timed(options?: TimedOptions): AsyncMethodDecorator {
  return decoratorOf(timedAdvice(options));
}
