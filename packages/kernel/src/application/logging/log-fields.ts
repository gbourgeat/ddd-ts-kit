import type { LogValue } from './log-value';

/**
 * Structured fields of a log entry. The well-known keys are spelled once here so that every
 * adapter and every dashboard agrees on them; a project adds its own by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface LogFields { orderId?: string; error?: Error }
 *     }
 */
export interface LogFields {
  correlationId?: string;
  causationId?: string;
  /** Bounded context the entry is about. */
  context?: string;
  actorId?: string;
  tenantId?: string;
  /** Class name of a caught error, as `identifyError` gives it: what the kit logs of an error, never its message. */
  errorType?: string;
  /** The stable `code` of a `DomainError`. */
  errorCode?: string;
  durationMs?: number;
  [key: string]: LogValue;
}
