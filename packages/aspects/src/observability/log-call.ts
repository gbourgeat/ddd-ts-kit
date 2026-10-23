import type { Clock, LogFields, LogLevel, Logger } from '@ddd-ts-kit/kernel';
import { observed } from './observed';
import { safely } from './safely';

export interface LoggedCall {
  readonly logger: Logger;
  readonly clock: Clock;
  readonly level: LogLevel;
  /** What is called, as the entries name it. */
  readonly operation: string;
  /** Read for an entry that is written, never for one below the level of the logger. */
  readonly fields: () => LogFields;
}

interface Outcome {
  readonly word: 'started' | 'succeeded' | 'failed';
  readonly fields?: LogFields;
}

/** The three entries of one call: started, then succeeded or failed with the duration. */
export function logCall<T>(call: LoggedCall, proceed: () => Promise<T>): Promise<T> {
  safely(() => {
    write(call, 'debug', { word: 'started' });
  });

  return observed(call.clock, proceed, ({ durationMs, error, refused }) => {
    if (error === undefined) {
      write(call, call.level, { word: 'succeeded', fields: { durationMs } });

      return;
    }

    write(call, refused ? 'warn' : 'error', { word: 'failed', fields: { durationMs, ...error } });
  });
}

function write(call: LoggedCall, level: LogLevel, outcome: Outcome): void {
  if (!call.logger.isLevelEnabled(level)) {
    return;
  }

  call.logger[level](`${call.operation} ${outcome.word}`, { ...call.fields(), ...outcome.fields });
}
