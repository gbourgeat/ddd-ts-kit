import type { Clock, LogFields, LogLevel, Logger } from '@ddd-ts-kit/kernel';
import { observed } from './observed.js';
import { safely } from './safely.js';

export interface LoggedCall {
  readonly logger: Logger;
  readonly clock: Clock;
  readonly level: LogLevel;
  /** What is called, as the entries name it. */
  readonly operation: string;
  readonly fields: LogFields;
}

/** The three entries of one call: started, then succeeded or failed with the duration. */
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
