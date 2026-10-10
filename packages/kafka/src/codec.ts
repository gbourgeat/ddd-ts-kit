import type { KafkaJS } from '@confluentinc/kafka-javascript';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export const EVENT_ID_HEADER = 'x-event-id';
export const EVENT_TYPE_HEADER = 'x-event-type';
export const EVENT_VERSION_HEADER = 'x-event-version';
export const TRACEPARENT_HEADER = 'traceparent';
export const CORRELATION_HEADER = 'x-correlation-id';
export const ATTEMPT_HEADER = 'x-attempt';
export const ERROR_CODE_HEADER = 'x-error-code';
export const DEAD_REASON_HEADER = 'x-dead-reason';
/** Where a dead record came from: `<topic>/<partition>/<offset>`. */
export const SOURCE_HEADER = 'x-source';
/** Set on a replayed record: the one consumer it is meant for. The others skip it. */
export const REPLAY_FOR_HEADER = 'x-replay-for';

export interface Routing {
  readonly topicOf: (type: string) => string;
  readonly keyOf: (event: IntegrationEvent) => string | undefined;
}

export interface OutgoingRecord {
  readonly topic: string;
  readonly message: KafkaJS.Message;
}

/** A record as a consumer receives it. */
export interface IncomingRecord {
  readonly topic: string;
  readonly partition: number;
  readonly message: KafkaJS.KafkaMessage;
}

/**
 * The value is the whole envelope as JSON, so any Kafka client can consume it. The headers
 * repeat what a router, a tracer or an operator needs without opening the value.
 */
export function encode(event: IntegrationEvent, routing: Routing): OutgoingRecord {
  return {
    topic: routing.topicOf(event.type),
    message: {
      key: routing.keyOf(event) ?? null,
      value: JSON.stringify(event),
      headers: {
        [EVENT_ID_HEADER]: event.id,
        [EVENT_TYPE_HEADER]: event.type,
        [EVENT_VERSION_HEADER]: String(event.version),
        ...(event.traceparent === undefined ? {} : { [TRACEPARENT_HEADER]: event.traceparent }),
        ...(event.correlationId === undefined ? {} : { [CORRELATION_HEADER]: event.correlationId }),
      },
    },
  };
}

/** The envelope exactly as published, or `undefined` for a value that is not one (poison). */
export function decode(value: Buffer | null): IntegrationEvent | undefined {
  const body = value === null ? undefined : parsed(value);
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

/** The same record, key and value untouched, for another topic with `headers` added or replaced. */
export function republication(
  { message }: IncomingRecord,
  topic: string,
  headers: Record<string, string>,
): OutgoingRecord {
  return {
    topic,
    message: { key: message.key, value: message.value, headers: { ...message.headers, ...headers } },
  };
}

export function sourceOf({ topic, partition, message }: IncomingRecord): string {
  return `${topic}/${String(partition)}/${message.offset}`;
}

export function textHeader({ message }: IncomingRecord, name: string): string | undefined {
  const value = message.headers?.[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined ? undefined : first.toString();
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
