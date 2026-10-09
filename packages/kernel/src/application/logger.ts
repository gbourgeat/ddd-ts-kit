export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };

/**
 * Structured fields of a log entry. The well-known keys are spelled once here so that every
 * adapter and every dashboard agrees on them; a project adds its own by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface LogFields { orderId?: string }
 *     }
 */
export interface LogFields {
  correlationId?: string;
  causationId?: string;
  /** Bounded context the entry is about. */
  context?: string;
  actorId?: string;
  tenantId?: string;
  /** Class name of a caught error. Its message is never logged: it quotes data. */
  errorType?: string;
  /** The stable `code` of a `DomainError`. */
  errorCode?: string;
  durationMs?: number;
  [key: string]: LogValue;
}

/**
 * Structured logging, for infrastructure, presentation and cross-cutting code. The domain and
 * use cases do not log: what they have to say is an event or an error.
 */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** A logger adding the fields to every entry it writes. */
  child(fields: LogFields): Logger;
}

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
