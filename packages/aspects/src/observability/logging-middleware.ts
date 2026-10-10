import type { BusMiddleware, Clock, LogLevel, Logger } from '@ddd-ts-kit/kernel';
import { clockOr } from '../runtime/collaborators.js';
import { logCall } from './log-call.js';

export interface LoggingMiddlewareOptions {
  /** Level of the entry written on success. Default `info`. */
  readonly level?: LogLevel;
  /** Defaults to the clock of the aspect runtime, then to the system clock. */
  readonly clock?: Clock;
}

/**
 * `logged` for use cases: the same three entries around every command and query, named after
 * the message class, with `messageKind`. Never the content of the message or of the answer.
 */
export function loggingMiddleware(logger: Logger, options: LoggingMiddlewareOptions = {}): BusMiddleware {
  return (_message, next, info) =>
    logCall(
      {
        logger,
        clock: clockOr(options.clock),
        level: options.level ?? 'info',
        operation: `${info.kind} ${info.name}`,
        fields: { message: info.name, messageKind: info.kind },
      },
      next,
    );
}
