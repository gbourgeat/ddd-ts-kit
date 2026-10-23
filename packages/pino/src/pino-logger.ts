import { UNWRITABLE_FIELDS, type LogFields, type LogLevel, type Logger } from '@ddd-ts-kit/kernel';
import type { Logger as Pino } from 'pino';
import { lineFields } from './fields/line-fields';
import { holdWhileFlushing } from './hold-while-flushing';

export interface PinoLoggerOptions {
  /**
   * Writes `SCRUBBED_MESSAGE` for the message of every logged error that is not a
   * `DomainError`. Default `false`: see "Privacy" in the README for the trade-off.
   */
  readonly scrubMessages?: boolean;
}

/** Children of an instance the adapter already prepared: they are adopted as they are. */
const adopted = new WeakSet<Pino>();

/**
 * The `Logger` port on a pino instance: the levels of the port are those of pino, a child is
 * a pino child, and what the instance was configured with (mixin, redaction, destination)
 * applies to every line. `createPinoLogger` builds one with the defaults of the kit; build it
 * yourself around an instance you configured.
 */
export class PinoLogger implements Logger {
  private readonly pino: Pino;

  constructor(
    pino: Pino,
    private readonly options: PinoLoggerOptions = {},
  ) {
    this.pino = adopted.has(pino) ? pino : describingErrorsItself(pino);
  }

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

  child(fields: LogFields): PinoLogger {
    const child = this.nativeChild(fields);

    adopted.add(child);

    return new PinoLogger(child, this.options);
  }

  /** The threshold of the instance, followed when it changes while running. */
  isLevelEnabled(level: LogLevel): boolean {
    return this.pino.isLevelEnabled(level);
  }

  /**
   * Resolves once what pino buffered was handed to its destination. Never rejects, and the
   * logger stays usable: an entry logged afterwards is written like the others.
   */
  flush(): Promise<void> {
    const release = holdWhileFlushing();

    return new Promise<void>((resolve) => {
      try {
        this.pino.flush(() => {
          resolve();
        });
      } catch {
        resolve();
      }
    }).finally(release);
  }

  private nativeChild(fields: LogFields): Pino {
    try {
      return this.pino.child(lineFields(fields, this.options));
    } catch {
      return this.pino.child(UNWRITABLE_FIELDS);
    }
  }

  private write(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    try {
      this.pino[level](lineFields(fields, this.options), message);
    } catch {
      this.writeWithoutFields(level, message);
    }
  }

  private writeWithoutFields(level: LogLevel, message: string): void {
    try {
      this.pino[level](UNWRITABLE_FIELDS, message);
    } catch {
      return;
    }
  }
}

/**
 * The adapter describes errors before pino sees them. Left in place, the standard serializer
 * of the `err` key would take that description for an error and describe it a second time,
 * folding the causes into one message and one stack.
 */
function describingErrorsItself(pino: Pino): Pino {
  return pino.child({}, { serializers: { err: (description: unknown) => description } });
}
