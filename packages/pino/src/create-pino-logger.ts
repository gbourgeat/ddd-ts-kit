import { CREDENTIAL_KEYS, type LogFields, type LogLevel } from '@ddd-ts-kit/kernel';
import { pino, type DestinationStream, type LoggerOptions } from 'pino';
import { correlationMixin } from './correlation/correlation-mixin.js';
import { PinoLogger, type PinoLoggerOptions } from './pino-logger.js';
import { credentialRedaction } from './redaction/credential-redaction.js';

export interface CreatePinoLoggerOptions extends PinoLoggerOptions {
  /** Entries below it are not written. Default `info`. */
  readonly level?: LogLevel;
  /**
   * `json`: one JSON object per line, what a container platform collects. `pretty`: lines for
   * a human, through the `pino-pretty` transport, which must then be installed. Default `json`.
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
  /**
   * Buffers the lines and writes them off the hot path. Default `false`: every line is
   * written before the call returns. See "Performance" in the README for what a crash loses.
   */
  readonly asynchronous?: boolean;
  /**
   * A stream, a file descriptor or a path. Default: the standard output. The `pretty` format
   * runs in a worker thread and takes a descriptor or a path only.
   */
  readonly destination?: DestinationStream | number | string;
}

const STANDARD_OUTPUT = 1;
const BUFFERED_BYTES = 4096;

/**
 * A `PinoLogger` on a pino instance with the defaults of the kit: `time` in ISO 8601, `level`
 * by its name, `message`, then the fields; credentials redacted; errors described once.
 */
export function createPinoLogger(options: CreatePinoLoggerOptions = {}): PinoLogger {
  const instance = pino(
    pinoOptions(options),
    options.format === 'pretty' ? prettyTransport(options) : destinationOf(options),
  );

  return new PinoLogger(instance, options.scrubMessages === undefined ? {} : { scrubMessages: options.scrubMessages });
}

function pinoOptions(options: CreatePinoLoggerOptions): LoggerOptions {
  return {
    level: options.level ?? 'info',
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    base: baseFields(options),
    formatters: { level: (label) => ({ level: label }) },
    redact: credentialRedaction([...CREDENTIAL_KEYS, ...(options.redact ?? [])]),
    ...(options.fields === undefined ? {} : { mixin: correlationMixin(options.fields) }),
  };
}

function baseFields(options: CreatePinoLoggerOptions): LogFields {
  return {
    ...(options.service === undefined ? {} : { service: options.service }),
    ...(options.environment === undefined ? {} : { environment: options.environment }),
    ...options.base,
  };
}

function prettyTransport(options: CreatePinoLoggerOptions): DestinationStream {
  if (typeof options.destination === 'object') {
    throw new TypeError('The pretty format writes to a file descriptor or a path: pino-pretty runs in a worker thread');
  }

  return pino.transport({
    target: 'pino-pretty',
    options: {
      destination: options.destination ?? STANDARD_OUTPUT,
      messageKey: 'message',
      translateTime: 'SYS:HH:MM:ss.l',
      sync: options.asynchronous !== true,
    },
  });
}

function destinationOf(options: CreatePinoLoggerOptions): DestinationStream {
  if (typeof options.destination === 'object') {
    return options.destination;
  }

  return pino.destination({
    dest: options.destination ?? STANDARD_OUTPUT,
    sync: options.asynchronous !== true,
    ...(options.asynchronous === true ? { minLength: BUFFERED_BYTES } : {}),
  });
}
