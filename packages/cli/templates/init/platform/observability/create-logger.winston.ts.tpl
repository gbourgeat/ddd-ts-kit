import { NoopLogger, type ExecutionScope, type LogLevel, type Logger } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';
import { createWinstonLogger } from '@ddd-ts-kit/winston';

/** Where log entries go. Left out (the tools, the tests), the application writes nothing. */
export interface LogSettings {
  readonly level: LogLevel;
  /** `json` everywhere; `pretty` on a developer's machine only. */
  readonly format: 'json' | 'pretty';
  readonly service: string;
  readonly environment: string;
  /** Writes `[message removed]` for the message of every logged error that is not a `DomainError`. */
  readonly scrubMessages: boolean;
}

/**
 * winston on the console, the credential keys of the kernel redacted. Every line carries what
 * the execution scope knows of the work in progress (correlation id, origin, actor, tenant) and
 * the ids of the active trace, so a request is followed from its log lines to its spans and to
 * its audit entries. `stop()` of the application flushes it, last: winston cannot reopen, so
 * what is logged after is dropped.
 */
export function createLogger(scope: ExecutionScope, settings: LogSettings | undefined): Logger {
  if (settings === undefined) {
    return new NoopLogger();
  }

  return createWinstonLogger({ ...settings, fields: () => traceLogFields(scope) });
}
