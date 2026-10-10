import { headers as emptyHeaders, type MsgHdrs } from '@nats-io/transport-node';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/** The header the stream deduplicates on: the event id. */
export const MESSAGE_ID_HEADER = 'Nats-Msg-Id';
export const EVENT_TYPE_HEADER = 'x-event-type';
export const EVENT_VERSION_HEADER = 'x-event-version';
export const TRACEPARENT_HEADER = 'traceparent';
export const CORRELATION_HEADER = 'x-correlation-id';
export const ATTEMPT_HEADER = 'x-attempt';
export const ERROR_CODE_HEADER = 'x-error-code';
export const DEAD_REASON_HEADER = 'x-dead-reason';
/** Where a dead message came from: `<stream>/<sequence>`. */
export const SOURCE_HEADER = 'x-source';
/** Set on a replayed message: the one durable consumer it is meant for. The others skip it. */
export const REPLAY_FOR_HEADER = 'x-replay-for';

export interface Publication {
  readonly data: string | Uint8Array;
  readonly messageId: string;
  readonly headers: MsgHdrs;
}

/**
 * The body is the whole envelope as JSON, so any NATS client can consume it. The headers
 * repeat what the stream, a tracer or an operator needs without opening the body.
 */
export function encode(event: IntegrationEvent): Publication {
  const headers = emptyHeaders();
  headers.set(EVENT_TYPE_HEADER, event.type);
  headers.set(EVENT_VERSION_HEADER, String(event.version));
  if (event.traceparent !== undefined) {
    headers.set(TRACEPARENT_HEADER, event.traceparent);
  }
  if (event.correlationId !== undefined) {
    headers.set(CORRELATION_HEADER, event.correlationId);
  }
  return { data: JSON.stringify(event), messageId: event.id, headers };
}

/** The envelope exactly as published, or `undefined` for a body that is not one (poison). */
export function decode(data: Uint8Array): IntegrationEvent | undefined {
  const body = parsed(data);
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

export interface Republished {
  readonly data: Uint8Array;
  readonly headers: MsgHdrs | undefined;
  /** Unique for this copy: the stream must not take it for a duplicate of the original. */
  readonly messageId: string;
}

/** The same message, for another subject, with `added` headers set or replaced. */
export function republication(message: Republished, added: Record<string, string>): Publication {
  const headers = emptyHeaders();
  for (const [name, values] of message.headers ?? []) {
    for (const value of name === MESSAGE_ID_HEADER ? [] : values) {
      headers.append(name, value);
    }
  }
  for (const [name, value] of Object.entries(added)) {
    headers.set(name, value);
  }
  return { data: message.data, messageId: message.messageId, headers };
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

function parsed(data: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(data));
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
