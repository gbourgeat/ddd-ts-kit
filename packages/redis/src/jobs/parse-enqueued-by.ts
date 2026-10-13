import { isActor, type EnqueuedBy } from '@ddd-ts-kit/kernel';

/** Reads who enqueued a job, as the store wrote it. */
export function parseEnqueuedBy(raw: string): EnqueuedBy {
  const parsed: unknown = JSON.parse(raw);
  const actor: unknown = typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'actor') : undefined;

  const correlationId: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'correlationId') : undefined;

  if (!isActor(actor) || typeof correlationId !== 'string') {
    throw new TypeError('Who enqueued a background job of Redis is not written the way the store writes it.');
  }

  const tenantId = textOf(parsed, 'tenantId');
  const traceparent = textOf(parsed, 'traceparent');

  return {
    correlationId,
    actor,
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(traceparent === undefined ? {} : { traceparent }),
  };
}

function textOf(value: unknown, field: string): string | undefined {
  const text: unknown = typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined;

  return typeof text === 'string' ? text : undefined;
}
