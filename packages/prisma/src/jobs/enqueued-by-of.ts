import { isActor, type EnqueuedBy } from '@ddd-ts-kit/kernel';

/** Reads who enqueued a job, as the store wrote it. */
export function enqueuedByOf(value: unknown): EnqueuedBy {
  const actor = fieldOf(value, 'actor');
  const correlationId = fieldOf(value, 'correlationId');

  if (!isActor(actor) || typeof correlationId !== 'string') {
    throw new TypeError('Who enqueued a background job is not written the way the store writes it.');
  }

  const tenantId = fieldOf(value, 'tenantId');
  const traceparent = fieldOf(value, 'traceparent');

  return {
    correlationId,
    actor,
    ...(typeof tenantId === 'string' ? { tenantId } : {}),
    ...(typeof traceparent === 'string' ? { traceparent } : {}),
  };
}

function fieldOf(value: unknown, field: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined;
}
