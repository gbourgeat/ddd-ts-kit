import { loggedAdvice, type LoggedOptions } from '../observability/logged';
import type { AsyncMethodDecorator } from './async-method-decorator';
import { decoratorOf } from './decorator-of';

/** See `logged`. The logger comes from the aspect runtime unless given. */
export function Logged(options?: LoggedOptions): AsyncMethodDecorator {
  return decoratorOf(loggedAdvice(options));
}
