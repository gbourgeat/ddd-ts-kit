import { timedAdvice, type TimedOptions } from '../observability/timed';
import type { AsyncMethodDecorator } from './async-method-decorator';
import { decoratorOf } from './decorator-of';

/** See `timed`. The metrics come from the aspect runtime unless given. */
export function Timed(options?: TimedOptions): AsyncMethodDecorator {
  return decoratorOf(timedAdvice(options));
}
