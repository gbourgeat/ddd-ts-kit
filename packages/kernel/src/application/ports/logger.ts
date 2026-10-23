import type { LogFields } from '../logging/log-fields';
import type { LogLevel } from '../logging/log-level';

/**
 * Structured logging, for infrastructure, presentation and cross-cutting code. The domain and
 * use cases do not log: what they have to say is an event or an error.
 *
 * A call never throws, whatever the fields: an entry whose fields cannot be read or serialized
 * is written with `UNWRITABLE_FIELDS` in their place.
 *
 * An `Error` directly under a key of the fields is written as `describeError` describes it:
 * `type` (its class name), `code` when it is a `DomainError`, `message`, its own `stack`, then
 * `cause` the same way, eight errors deep at most. Deeper in the fields an error is left to the
 * serializer of the adapter. A logger built with `scrubMessages: true` writes
 * `SCRUBBED_MESSAGE` for the message of every unexpected error, anything but a `DomainError`,
 * and drops the first line of its stack, which repeats it.
 *
 * The kit never hands an error to a logger: its aspects, middlewares and scheduler write
 * `errorType` and `errorCode` only (`identifyError`), and the error goes to the `ErrorReporter`.
 * The full description is for the error a project chooses to log.
 */
export abstract class Logger {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.Logger' });
  }

  abstract debug(message: string, fields?: LogFields): void;

  abstract info(message: string, fields?: LogFields): void;

  abstract warn(message: string, fields?: LogFields): void;

  abstract error(message: string, fields?: LogFields): void;

  /** A logger adding the fields to every entry it writes, with the level and the destination of this one. */
  abstract child(fields: LogFields): Logger;

  /**
   * Whether an entry of that level would be written, for this logger and its children. Asked
   * before building fields that cost; a logger that writes nothing answers `false`.
   */
  abstract isLevelEnabled(level: LogLevel): boolean;

  /**
   * Resolves once every entry logged so far, through this logger or a child, was handed to its
   * destination. Never rejects. Called once, when the process stops, after the last entry: an
   * entry logged afterwards may be written or dropped, depending on the adapter, and never
   * throws; a second call resolves too.
   */
  abstract flush(): Promise<void>;
}
