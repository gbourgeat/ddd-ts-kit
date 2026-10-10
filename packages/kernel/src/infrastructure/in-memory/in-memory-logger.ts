import { describeErrorFields } from '../../application/logging/describe-error-fields.js';
import type { LogFields } from '../../application/logging/log-fields.js';
import { LOG_LEVELS, type LogLevel } from '../../application/logging/log-level.js';
import type { LogValue } from '../../application/logging/log-value.js';
import { UNWRITABLE_FIELDS } from '../../application/logging/unwritable-fields.js';
import type { Logger } from '../../application/ports/logger.js';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  /** As a logger writes them: an `Error` passed as a field is its `ErrorDescription`. */
  readonly fields: Readonly<Record<string, LogValue>>;
}

export interface InMemoryLoggerOptions {
  /** Entries below it are not recorded. Default `debug`: every entry. */
  readonly level?: LogLevel;
  /** Read at each entry that is recorded: the fields of the work in progress, as a real adapter reads them. */
  readonly fields?: () => LogFields;
  /** Added to every entry. */
  readonly base?: LogFields;
  /** Records `SCRUBBED_MESSAGE` for the message of every error that is not a `DomainError`. Default `false`. */
  readonly scrubMessages?: boolean;
}

/** The fake: entries are data a test asserts. A child writes to the entries of its parent. */
export class InMemoryLogger implements Logger {
  constructor(
    private readonly options: InMemoryLoggerOptions = {},
    readonly entries: LogEntry[] = [],
  ) {}

  debug(message: string, fields?: LogFields): void {
    this.write('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write('error', message, fields);
  }

  child(fields: LogFields): InMemoryLogger {
    return new InMemoryLogger({ ...this.options, base: this.boundWith(fields) }, this.entries);
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(this.options.level ?? 'debug');
  }

  /** Nothing is buffered: entries logged afterwards are recorded like the others. */
  flush(): Promise<void> {
    return Promise.resolve();
  }

  clear(): void {
    this.entries.length = 0;
  }

  private write(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (!this.isLevelEnabled(level)) return;

    this.entries.push({ level, message, fields: this.recorded(fields) });
  }

  private recorded(fields: LogFields): Record<string, LogValue> {
    try {
      return describeErrorFields({ ...this.options.base, ...this.ambientFields(), ...fields }, this.options);
    } catch {
      return { ...UNWRITABLE_FIELDS };
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
