import type { LogFields, LogLevel, Logger } from '../application/logger.js';

/** Writes nothing. The default until the platform binds a real adapter. */
export class NoopLogger implements Logger {
  debug(): void {
    return undefined;
  }

  info(): void {
    return undefined;
  }

  warn(): void {
    return undefined;
  }

  error(): void {
    return undefined;
  }

  child(): Logger {
    return this;
  }
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields: LogFields;
}

/** The fake: entries are data a test asserts. A child writes to the entries of its parent. */
export class InMemoryLogger implements Logger {
  readonly #fields: LogFields;

  constructor(
    fields: LogFields = {},
    readonly entries: LogEntry[] = [],
  ) {
    this.#fields = fields;
  }

  debug(message: string, fields?: LogFields): void {
    this.#write('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.#write('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.#write('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.#write('error', message, fields);
  }

  child(fields: LogFields): InMemoryLogger {
    return new InMemoryLogger({ ...this.#fields, ...fields }, this.entries);
  }

  clear(): void {
    this.entries.length = 0;
  }

  #write(level: LogLevel, message: string, fields: LogFields = {}): void {
    this.entries.push({ level, message, fields: { ...this.#fields, ...fields } });
  }
}
