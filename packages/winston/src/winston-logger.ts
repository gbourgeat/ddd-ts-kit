import { UNWRITABLE_FIELDS, describeErrorFields, type LogFields, type LogLevel, type Logger } from '@ddd-ts-kit/kernel';
import type winston from 'winston';
import { endOf } from './end-of.js';

export interface WinstonLoggerOptions {
  /**
   * Writes `SCRUBBED_MESSAGE` for the message of every logged error that is not a
   * `DomainError`. Default `false`: see "Privacy" in the README for the trade-off.
   */
  readonly scrubMessages?: boolean;
  /**
   * The winston level each level of the port is written at. Default: the level of the same
   * name, which the `npm` and `cli` levels of winston have. An instance on the `syslog`
   * levels needs `{ warn: 'warning' }`: a level the instance does not know is dropped.
   */
  readonly levels?: Partial<Readonly<Record<LogLevel, string>>>;
}

/**
 * The `Logger` port on a winston logger: a child is a winston child, and the formats and the
 * transports the instance was configured with apply to every line. `createWinstonLogger`
 * builds one with the defaults of the kit; build it yourself around an instance you configured.
 */
export class WinstonLogger implements Logger {
  private root: WinstonLogger = this;
  private ended: Promise<void> | undefined;

  constructor(
    private readonly winston: winston.Logger,
    private readonly options: WinstonLoggerOptions = {},
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

  child(fields: LogFields): WinstonLogger {
    const child = new WinstonLogger(this.nativeChild(fields), this.options);

    child.root = this.root;

    return child;
  }

  /**
   * Whether winston would hand an entry of that level to a transport. winston filters by level
   * in its transports, after the formats: asked here, a dropped entry costs nothing. `false`
   * for every level once the logger was flushed.
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.root.ended === undefined && this.winston.isLevelEnabled(this.nativeLevel(level));
  }

  /**
   * Ends the winston logger and resolves once its transports have written everything. Final:
   * what is logged afterwards, through this logger or a child, is dropped without a throw. A
   * second call answers the same promise. Never rejects.
   */
  flush(): Promise<void> {
    this.root.ended ??= endOf(this.root.winston).catch(() => undefined);

    return this.root.ended;
  }

  private nativeChild(fields: LogFields): winston.Logger {
    try {
      return this.winston.child(describeErrorFields(fields, this.options));
    } catch {
      return this.winston.child(UNWRITABLE_FIELDS);
    }
  }

  private write(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (!this.isLevelEnabled(level)) return;

    const native = this.nativeLevel(level);

    try {
      this.winston.log({ ...describeErrorFields(fields, this.options), level: native, message });
    } catch {
      this.writeWithoutFields(native, message);
    }
  }

  private nativeLevel(level: LogLevel): string {
    return this.options.levels?.[level] ?? level;
  }

  private writeWithoutFields(level: string, message: string): void {
    try {
      this.winston.log({ ...UNWRITABLE_FIELDS, level, message });
    } catch {
      return;
    }
  }
}
