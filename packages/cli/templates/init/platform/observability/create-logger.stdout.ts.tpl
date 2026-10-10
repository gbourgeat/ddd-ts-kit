import { StdoutLogger } from '@ddd-ts-kit/aspects';
import { NoopLogger, type ExecutionScope, type LogLevel, type Logger } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';

/** Where log entries go. Left out (the tools, the tests), the application writes nothing. */
export interface LogSettings {
  readonly level: LogLevel;
  /** `json` only: this logger has no pretty format, and `LOG_FORMAT=pretty` is refused when the configuration is loaded. */
  readonly format: 'json';
  readonly service: string;
  readonly environment: string;
  /** Writes `[message removed]` for the message of every logged error that is not a `DomainError`. */
  readonly scrubMessages: boolean;
}

/**
 * JSON lines on the standard output, credentials not redacted (`init --logger pino` or
 * `--logger winston` redacts them and has a pretty format). Every entry carries
 * what the execution scope knows of the work in progress (correlation id, origin, actor,
 * tenant) and the ids of the active trace, so a request is followed from its log lines to its
 * spans and to its audit entries. `stop()` of the application flushes it, last.
 */
export function createLogger(scope: ExecutionScope, settings: LogSettings | undefined): Logger {
  if (settings === undefined) {
    return new NoopLogger();
  }

  const { level, service, environment, scrubMessages } = settings;

  return new StdoutLogger({
    level,
    base: { service, environment },
    scrubMessages,
    fields: () => traceLogFields(scope),
  });
}
