import type { Message, Options } from 'amqplib';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export const ATTEMPT_HEADER = 'x-attempt';
export const ERROR_CODE_HEADER = 'x-error-code';
export const DEAD_REASON_HEADER = 'x-dead-reason';
export const EVENT_VERSION_HEADER = 'x-event-version';
export const TRACEPARENT_HEADER = 'traceparent';
export const CORRELATION_HEADER = 'x-correlation-id';

export interface Publication {
  readonly content: Buffer;
  readonly properties: Options.Publish;
}

/**
 * The body is the whole envelope as JSON, so any AMQP client can consume it. Properties and
 * headers repeat what a broker, a tracer or an operator needs without opening the body.
 */
export function encode(event: IntegrationEvent): Publication {
  return {
    content: Buffer.from(JSON.stringify(event)),
    properties: {
      persistent: true,
      contentType: 'application/json',
      messageId: event.id,
      type: event.type,
      ...(event.correlationId === undefined ? {} : { correlationId: event.correlationId }),
      headers: {
        [EVENT_VERSION_HEADER]: event.version,
        ...(event.traceparent === undefined ? {} : { [TRACEPARENT_HEADER]: event.traceparent }),
        ...(event.correlationId === undefined ? {} : { [CORRELATION_HEADER]: event.correlationId }),
      },
    },
  };
}

/** The envelope exactly as published, or `undefined` for a body that is not one (poison). */
export function decode(message: Message): IntegrationEvent | undefined {
  const body = parsed(message.content);
  if (!isEnvelope(body)) {
    return undefined;
  }
  return {
    id: body.id,
    type: body.type,
    version: body.version,
    occurredAt: body.occurredAt,
    payload: body.payload,
    ...(typeof body.traceparent === 'string' ? { traceparent: body.traceparent } : {}),
    ...(typeof body.correlationId === 'string' ? { correlationId: body.correlationId } : {}),
  };
}

/** The same message, to send to another queue with `headers` added or replaced. */
export function republication(message: Message, headers: Record<string, string | number>): Publication {
  const { properties } = message;
  return {
    content: message.content,
    properties: {
      persistent: true,
      contentType: 'application/json',
      ...textProperty('messageId', properties.messageId),
      ...textProperty('type', properties.type),
      ...textProperty('correlationId', properties.correlationId),
      headers: { ...headersOf(message), ...headers },
    },
  };
}

/** Which delivery this is, starting at 1: the header is set when the bus schedules a retry. */
export function attemptOf(message: Message): number {
  const attempt = headersOf(message)[ATTEMPT_HEADER];
  return typeof attempt === 'number' && Number.isInteger(attempt) && attempt >= 1 ? attempt : 1;
}

interface Envelope {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload?: unknown;
  readonly traceparent?: unknown;
  readonly correlationId?: unknown;
}

function parsed(content: Buffer): unknown {
  try {
    return JSON.parse(content.toString('utf8'));
  } catch {
    return undefined;
  }
}

function isEnvelope(body: unknown): body is Envelope {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  return (
    hasText(body, 'id') &&
    hasText(body, 'type') &&
    hasText(body, 'occurredAt') &&
    'version' in body &&
    typeof body.version === 'number'
  );
}

function hasText(body: object, field: string): boolean {
  const value: unknown = Reflect.get(body, field);
  return typeof value === 'string' && value.length > 0;
}

function textProperty(name: string, value: unknown): Record<string, string> {
  return typeof value === 'string' ? { [name]: value } : {};
}

function headersOf(message: Message): Record<string, unknown> {
  const headers: unknown = message.properties.headers;
  return typeof headers === 'object' && headers !== null ? { ...headers } : {};
}
