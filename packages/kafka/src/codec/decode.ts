import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

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
    ...(typeof body.tenantId === 'string' ? { tenantId: body.tenantId } : {}),
  };
}

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
