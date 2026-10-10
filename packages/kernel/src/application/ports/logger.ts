import type { LogFields } from '../logging/log-fields.js';

/**
 * Structured logging, for infrastructure, presentation and cross-cutting code. The domain and
 * use cases do not log: what they have to say is an event or an error.
 */
export abstract class Logger {
  static readonly tokenKey = 'kernel.Logger';

  abstract debug(message: string, fields?: LogFields): void;

  abstract info(message: string, fields?: LogFields): void;

  abstract warn(message: string, fields?: LogFields): void;

  abstract error(message: string, fields?: LogFields): void;

  /** A logger adding the fields to every entry it writes. */
  abstract child(fields: LogFields): Logger;
}
