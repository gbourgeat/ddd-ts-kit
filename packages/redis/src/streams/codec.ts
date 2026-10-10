import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export const ENVELOPE_FIELD = 'envelope';
export const EVENT_ID_FIELD = 'id';
export const EVENT_TYPE_FIELD = 'type';
export const EVENT_VERSION_FIELD = 'version';
export const TRACEPARENT_FIELD = 'traceparent';
export const CORRELATION_FIELD = 'correlation-id';
export const REPLAY_FOR_FIELD = 'replay-for';
export const ERROR_CODE_FIELD = 'error-code';
export const DEAD_REASON_FIELD = 'dead-reason';
export const ATTEMPT_FIELD = 'attempt';
export const CONSUMER_FIELD = 'consumer';
export const ENTRY_ID_FIELD = 'entry-id';

/** One entry of a stream: its id and its fields, in the order the server holds them. */
export interface Entry {
  readonly id: string;
  readonly fields: ReadonlyMap<string, string>;
}

/** One line of the pending entry list of a group. */
export interface PendingEntry {
  readonly id: string;
  readonly consumer: string;
  readonly deliveries: number;
}

/**
 * The fields of an entry: the whole envelope as JSON, so any client of the protocol can
 * consume it, and beside it what an operator, a tracer or a filter needs without parsing it.
 */
export function encode(event: IntegrationEvent): string[] {
  return [
    EVENT_ID_FIELD,
    event.id,
    EVENT_TYPE_FIELD,
    event.type,
    EVENT_VERSION_FIELD,
    String(event.version),
    ...(event.traceparent === undefined ? [] : [TRACEPARENT_FIELD, event.traceparent]),
    ...(event.correlationId === undefined ? [] : [CORRELATION_FIELD, event.correlationId]),
    ENVELOPE_FIELD,
    JSON.stringify(event),
  ];
}

/** The envelope exactly as published, or `undefined` for an entry that does not hold one (poison). */
export function decode(entry: Entry): IntegrationEvent | undefined {
  const body = parsed(entry.fields.get(ENVELOPE_FIELD));
  if (!isEnvelope(body)) return undefined;
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

/** The fields of an entry, flat, with `added` put last: where a field is repeated, the last one is read. */
export function fieldsWith(entry: Entry, added: Readonly<Record<string, string>>): string[] {
  const kept = [...entry.fields].filter(([name]) => !(name in added));
  return [...kept, ...Object.entries(added)].flat();
}

/** The fields of a dead entry as they were published, addressed to the consumer it died for. */
export function replayFields(dead: Entry, consumer: string): string[] {
  const published = [...dead.fields].filter(([name]) => !DEAD_LETTER_FIELDS.has(name));
  return [...published, [REPLAY_FOR_FIELD, consumer]].flat();
}

/** The reply of `XREADGROUP`: the entries read, stream by stream. Nothing to read is `null`. */
export function entriesByStream(reply: unknown): Map<string, Entry[]> {
  const read = new Map<string, Entry[]>();
  for (const answer of listOf(reply)) {
    const [stream, entries] = listOf(answer);
    if (typeof stream === 'string') read.set(stream, entriesOf(entries));
  }
  return read;
}

/** The reply of `XRANGE` and `XCLAIM`. An entry deleted from its stream comes back empty and is left out. */
export function entriesOf(reply: unknown): Entry[] {
  return listOf(reply).flatMap((answer) => {
    const [id, fields] = listOf(answer);
    return typeof id === 'string' && Array.isArray(fields) ? [{ id, fields: fieldMapOf(fields) }] : [];
  });
}

/** The reply of the extended `XPENDING`: id, owner, idle time, delivery counter. */
export function pendingOf(reply: unknown): PendingEntry[] {
  return listOf(reply).flatMap((answer) => {
    const [id, consumer, , deliveries] = listOf(answer);
    return typeof id === 'string' && typeof consumer === 'string' ? [{ id, consumer, deliveries: Number(deliveries) }] : [];
  });
}

const DEAD_LETTER_FIELDS: ReadonlySet<string> = new Set([
  ERROR_CODE_FIELD,
  DEAD_REASON_FIELD,
  ATTEMPT_FIELD,
  CONSUMER_FIELD,
  ENTRY_ID_FIELD,
  REPLAY_FOR_FIELD,
]);

interface Envelope {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload?: unknown;
  readonly traceparent?: unknown;
  readonly correlationId?: unknown;
}

function parsed(envelope: string | undefined): unknown {
  try {
    return envelope === undefined ? undefined : JSON.parse(envelope);
  } catch {
    return undefined;
  }
}

function isEnvelope(body: unknown): body is Envelope {
  if (typeof body !== 'object' || body === null) return false;
  return hasText(body, 'id') && hasText(body, 'type') && hasText(body, 'occurredAt') && 'version' in body && typeof body.version === 'number';
}

function hasText(body: object, field: string): boolean {
  const value: unknown = Reflect.get(body, field);
  return typeof value === 'string' && value.length > 0;
}

function listOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function fieldMapOf(flat: readonly unknown[]): Map<string, string> {
  const fields = new Map<string, string>();
  for (let index = 0; index + 1 < flat.length; index += 2) {
    fields.set(String(flat[index]), String(flat[index + 1]));
  }
  return fields;
}
