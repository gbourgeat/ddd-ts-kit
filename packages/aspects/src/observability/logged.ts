import type { Clock, LogFields, LogLevel, Logger } from '@ddd-ts-kit/kernel';
import type { AdviceFactory } from '../aspect/advice-factory.js';
import type { Aspect } from '../aspect/aspect.js';
import { defineAspect } from '../aspect/define-aspect.js';
import type { JoinPoint } from '../aspect/join-point.js';
import { clockOr } from '../runtime/clock-or.js';
import { loggerOr } from '../runtime/logger-or.js';
import { logCall } from './log-call.js';

export interface LoggedOptions {
  /** Level of the entry written on success. Default `info`. The start entry is `debug`. */
  readonly level?: LogLevel;
  /** Added to every entry: static fields, or a function read at each entry that is written. Never call data. */
  readonly fields?: LogFields | (() => LogFields);
  /** Defaults to the logger of the aspect runtime. */
  readonly logger?: Logger;
  /** Defaults to the clock of the aspect runtime. */
  readonly clock?: Clock;
}

/**
 * Three entries per call: `<Class>.<method> started` (debug), then `succeeded` or `failed`
 * with the duration. A failure carries the class of the error and its code, at `warn` for a
 * business refusal and `error` for a fault. Never arguments, results or error messages, and
 * nothing is built for an entry the logger would not write.
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
          fields: () => ({ ...subject, ...extraFields(options) }),
        },
        proceed,
      );
  };
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
