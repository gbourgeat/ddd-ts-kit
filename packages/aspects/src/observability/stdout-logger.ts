import {
  LOG_LEVELS,
  UNWRITABLE_FIELDS,
  describeErrorFields,
  type Clock,
  type LogFields,
  type LogLevel,
  type Logger,
} from '@ddd-ts-kit/kernel';
import { clockOr } from '../runtime/clock-or';

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
  /**
   * Writes `SCRUBBED_MESSAGE` for the message of every logged error that is not a
   * `DomainError`. Default `false`: see "StdoutLogger" in the README for the trade-off.
   */
  readonly scrubMessages?: boolean;
  /** Defaults to the clock of the aspect runtime, then to the system clock. */
  readonly clock?: Clock;
  /** Receives each line, newline included. Defaults to the standard output. */
  readonly write?: (line: string) => void;
}

interface Header {
  readonly time: string;
  readonly level: LogLevel;
  readonly message: string;
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
    return new StdoutLogger({ ...this.options, base: this.boundWith(fields) });
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(this.options.level ?? 'info');
  }

  /**
   * Resolves once the standard output took every line written so far; at once with a `write`
   * of the project, which is called before each log call returns. The logger stays usable.
   */
  flush(): Promise<void> {
    if (this.options.write !== undefined) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        process.stdout.write('', () => {
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  private writeEntry(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const header = { time: clockOr(this.options.clock).now().toISOString(), level, message };

    (this.options.write ?? writeToStdout)(`${this.serialized(header, fields)}\n`);
  }

  private serialized(header: Header, fields: LogFields): string {
    try {
      const written = describeErrorFields({ ...this.options.base, ...this.ambientFields(), ...fields }, this.options);

      return JSON.stringify({ ...header, ...written, ...header });
    } catch {
      return JSON.stringify({ ...header, ...UNWRITABLE_FIELDS });
    }
  }

  private ambientFields(): LogFields {
    try {
      return this.options.fields?.() ?? {};
    } catch {
      return {};
    }
  }

  private boundWith(fields: LogFields): LogFields {
    try {
      return { ...this.options.base, ...fields };
    } catch {
      return { ...this.options.base, ...UNWRITABLE_FIELDS };
    }
  }
}

function writeToStdout(line: string): void {
  process.stdout.write(line);
}
