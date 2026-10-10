import type { LogValue } from './log-value.js';

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
