import { LOG_LEVELS, type Clock, type LogFields, type LogLevel, type Logger } from '@ddd-ts-kit/kernel';
import { clockOr } from '../runtime/collaborators.js';

export interface StdoutLoggerOptions {
  /** Entries below it are not written. Default `info`. */
  readonly level?: LogLevel;
  /**
   * Read at each entry: correlation fields of the work in progress, such as the trace ids of
   * the tracing package or `logFieldsOf` of the current execution context.
   */
  readonly fields?: () => LogFields;
  /** Added to every entry: service name, version, environment. */
  readonly base?: LogFields;
  /** Defaults to the clock of the aspect runtime, then to the system clock. */
  readonly clock?: Clock;
  /** Receives each line, newline included. Defaults to the standard output. */
  readonly write?: (line: string) => void;
}

/**
 * The `Logger` port as JSON lines: one object per entry with `time`, `level`, `message`, then
 * the fields. What a container platform collects as it is.
 */
export class StdoutLogger implements Logger {
  constructor(private readonly options: StdoutLoggerOptions = {}) {}

  debug(message: string, fields?: LogFields): void {
    this.writeEntry('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.writeEntry('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.writeEntry('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.writeEntry('error', message, fields);
  }

  child(fields: LogFields): StdoutLogger {
    return new StdoutLogger({ ...this.options, base: { ...this.options.base, ...fields } });
  }

  private writeEntry(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.options.level ?? 'info')) return;

    const header = { time: clockOr(this.options.clock).now().toISOString(), level, message };
    const entry = { ...header, ...this.options.base, ...this.ambientFields(), ...fields, ...header };

    (this.options.write ?? writeToStdout)(`${serialized(entry, header)}\n`);
  }

  private ambientFields(): LogFields {
    try {
      return this.options.fields?.() ?? {};
    } catch {
      return {};
    }
  }
}

function serialized(entry: LogFields, header: LogFields): string {
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({ ...header, logError: 'unserializable fields' });
  }
}

function writeToStdout(line: string): void {
  process.stdout.write(line);
}
