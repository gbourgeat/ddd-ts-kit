import { NoopLogger, type ExecutionScope, type LogLevel, type Logger } from '@ddd-ts-kit/kernel';
import { createPinoLogger } from '@ddd-ts-kit/pino';
import { traceLogFields } from '@ddd-ts-kit/tracing';

/** Where log entries go. Left out (the tools, the tests), the application writes nothing. */
export interface LogSettings {
  readonly level: LogLevel;
  /** `json` everywhere; `pretty` (through `pino-pretty`, in a worker thread) on a developer's machine only. */
  readonly format: 'json' | 'pretty';
  readonly service: string;
  readonly environment: string;
  /** Writes `[message removed]` for the message of every logged error that is not a `DomainError`. */
  readonly scrubMessages: boolean;
  /** Where the lines are written instead of the standard output: what a test reads them from. `json` only. */
  readonly destination?: LogDestination;
}

/** What receives each line, already serialized. */
interface LogDestination {
  write(line: string): void;
}

/**
 * pino on the standard output, the credential keys of the kernel redacted. Every line carries
 * what the execution scope knows of the work in progress (correlation id, origin, actor,
 * tenant) and the ids of the active trace, so a request is followed from its log lines to its
 * spans and to its audit entries. `stop()` of the application flushes it, last.
 */
export function createLogger(scope: ExecutionScope, settings: LogSettings | undefined): Logger {
  if (settings === undefined) {
    return new NoopLogger();
  }

  return createPinoLogger({ ...settings, fields: () => traceLogFields(scope) });
}
