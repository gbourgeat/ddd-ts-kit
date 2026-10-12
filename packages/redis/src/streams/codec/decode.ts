import { isTenantId, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { Entry } from './entry.js';
import { ENVELOPE_FIELD } from './entry-fields.js';

interface Envelope {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload?: unknown;
  readonly traceparent?: unknown;
  readonly correlationId?: unknown;
  readonly tenantId?: unknown;
}

/** The envelope exactly as published, or `undefined` for an entry that does not hold one (poison). */
export function decode(entry: Entry): IntegrationEvent | undefined {
  const body = parsed(entry.fields.get(ENVELOPE_FIELD));

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
    ...(isTenantId(body.tenantId) ? { tenantId: body.tenantId } : {}),
  };
}

function parsed(envelope: string | undefined): unknown {
  try {
    return envelope === undefined ? undefined : JSON.parse(envelope);
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
    typeof body.version === 'number' &&
    // A tenant outside the grammar could widen what the consumer reaches: the envelope is poison.
    (!('tenantId' in body) || body.tenantId === undefined || isTenantId(body.tenantId))
  );
}

function hasText(body: object, field: string): boolean {
  const value: unknown = Reflect.get(body, field);

  return typeof value === 'string' && value.length > 0;
}
