import type { Clock, LogFields, LogLevel, Logger } from '@ddd-ts-kit/kernel';
import { defineAspect } from './aspect.js';
import type { AdviceFactory, Aspect, JoinPoint } from './types.js';
import { observed, safely } from './observe.js';
import { clockOr, loggerOr } from './runtime.js';

export interface LoggedOptions {
  /** Level of the entry written on success. Default `info`. The start entry is `debug`. */
  readonly level?: LogLevel;
  /** Added to every entry: static fields, or a function read at each call. Never call data. */
  readonly fields?: LogFields | (() => LogFields);
  /** Defaults to the logger of the aspect runtime. */
  readonly logger?: Logger;
  /** Defaults to the clock of the aspect runtime. */
  readonly clock?: Clock;
}

/**
 * Three entries per call: `<Class>.<method> started` (debug), then `succeeded` or `failed`
 * with the duration. A failure carries the class of the error and its code, at `warn` for a
 * business refusal and `error` for a fault. Never arguments, results or error messages.
 */
export function logged(options: LoggedOptions = {}): Aspect {
  return defineAspect(loggedAdvice(options));
}

export function loggedAdvice(options: LoggedOptions = {}): AdviceFactory {
  return (joinPoint) => {
    const operation = `${joinPoint.className}.${joinPoint.method}`;
    const subject = subjectFields(joinPoint);
    return ({ proceed }) =>
      logCall(
        {
          logger: loggerOr(options.logger),
          clock: clockOr(options.clock),
          level: options.level ?? 'info',
          operation,
          fields: { ...subject, ...extraFields(options) },
        },
        proceed,
      );
  };
}

export interface LoggedCall {
  readonly logger: Logger;
  readonly clock: Clock;
  readonly level: LogLevel;
  /** What is called, as the entries name it. */
  readonly operation: string;
  readonly fields: LogFields;
}

export function logCall<T>(call: LoggedCall, proceed: () => Promise<T>): Promise<T> {
  const { logger, operation, fields } = call;
  safely(() => {
    logger.debug(`${operation} started`, fields);
  });
  return observed(call.clock, proceed, ({ durationMs, error, refused }) => {
    if (error === undefined) {
      logger[call.level](`${operation} succeeded`, { ...fields, durationMs });
      return;
    }
    logger[refused ? 'warn' : 'error'](`${operation} failed`, { ...fields, durationMs, ...error });
  });
}

function subjectFields(joinPoint: JoinPoint): LogFields {
  return {
    class: joinPoint.className,
    method: joinPoint.method,
    ...(joinPoint.kind === undefined ? {} : { kind: joinPoint.kind }),
    ...(joinPoint.context === undefined ? {} : { context: joinPoint.context }),
  };
}

function extraFields(options: LoggedOptions): LogFields {
  return typeof options.fields === 'function' ? options.fields() : (options.fields ?? {});
}
