import { CREDENTIAL_KEYS, type LogFields, type LogLevel } from '@ddd-ts-kit/kernel';
import winston from 'winston';
import { correlationFields } from './formats/correlation-fields.js';
import { isoTime } from './formats/iso-time.js';
import { readableLine } from './formats/readable-line.js';
import { redactCredentials } from './formats/redact-credentials.js';
import { unbreakable } from './formats/unbreakable.js';
import { WinstonLogger, type WinstonLoggerOptions } from './winston-logger.js';

export interface CreateWinstonLoggerOptions extends Pick<WinstonLoggerOptions, 'scrubMessages'> {
  /** Entries below it are not written. Default `info`. */
  readonly level?: LogLevel;
  /**
   * `json`: one JSON object per line, what a container platform collects. `pretty`: one
   * coloured line for a human, with winston's own formats. Default `json`.
   */
  readonly format?: 'json' | 'pretty';
  /** Written on every line as `service`. */
  readonly service?: string;
  /** Written on every line as `environment`. */
  readonly environment?: string;
  /** Added to every line next to `service` and `environment`: version, region. */
  readonly base?: LogFields;
  /**
   * Read at each line that is written: correlation fields of the work in progress, such as
   * `traceLogFields` of the tracing package or `logFieldsOf` of the current execution context.
   */
  readonly fields?: () => LogFields;
  /** Field names hidden in addition to `CREDENTIAL_KEYS`, at the top of a line and one level below. */
  readonly redact?: readonly string[];
  /** Where the lines go. Default: the console transport, on the standard output. */
  readonly transports?: NonNullable<winston.LoggerOptions['transports']>;
}

/**
 * A `WinstonLogger` on a winston logger with the defaults of the kit: `time` in ISO 8601,
 * `level` by its name, `message`, then the fields; credentials redacted; errors described once.
 */
export function createWinstonLogger(options: CreateWinstonLoggerOptions = {}): WinstonLogger {
  const logger = winston.createLogger({
    level: options.level ?? 'info',
    levels: winston.config.npm.levels,
    defaultMeta: baseFields(options),
    format: unbreakable(lineFormat(options)),
    transports: options.transports ?? [new winston.transports.Console()],
    exitOnError: false,
  });

  return new WinstonLogger(logger, options.scrubMessages === undefined ? {} : { scrubMessages: options.scrubMessages });
}

function baseFields(options: CreateWinstonLoggerOptions): LogFields {
  return {
    ...(options.service === undefined ? {} : { service: options.service }),
    ...(options.environment === undefined ? {} : { environment: options.environment }),
    ...options.base,
  };
}

function lineFormat(options: CreateWinstonLoggerOptions): winston.Logform.Format {
  return winston.format.combine(
    ...(options.fields === undefined ? [] : [correlationFields(options.fields)]),
    redactCredentials([...CREDENTIAL_KEYS, ...(options.redact ?? [])]),
    isoTime(),
    options.format === 'pretty' ? readableLine() : winston.format.json(),
  );
}
