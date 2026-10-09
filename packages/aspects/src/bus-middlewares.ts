import type { BusMiddleware, Clock, LogLevel, Logger, Metrics } from '@ddd-ts-kit/kernel';
import { logCall } from './logged.js';
import { clockOr } from './runtime.js';
import { timeCall } from './timed.js';

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

export interface MetricsMiddlewareOptions {
  /** Prefix of the two series: `<name>_duration_ms` and `<name>_total`. Default `use_case`. */
  readonly name?: string;
  /** Defaults to the clock of the aspect runtime, then to the system clock. */
  readonly clock?: Clock;
}

/** `timed` for use cases: duration and outcome of every command and query, labelled `message` and `kind`. */
export function metricsMiddleware(metrics: Metrics, options: MetricsMiddlewareOptions = {}): BusMiddleware {
  return (_message, next, info) =>
    timeCall(
      {
        metrics,
        clock: clockOr(options.clock),
        name: options.name ?? 'use_case',
        labels: { message: info.name, kind: info.kind },
      },
      next,
    );
}
