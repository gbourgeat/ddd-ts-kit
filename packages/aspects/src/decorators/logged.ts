import { loggedAdvice, type LoggedOptions } from '../observability/logged.js';
import type { AsyncMethodDecorator } from './async-method-decorator.js';
import { decoratorOf } from './decorator-of.js';

/** See `logged`. The logger comes from the aspect runtime unless given. */
export function Logged(options?: LoggedOptions): AsyncMethodDecorator {
  return decoratorOf(loggedAdvice(options));
}
