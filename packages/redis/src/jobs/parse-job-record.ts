import type { RedisJobRecord } from './redis-job-record';

/** Reads a record the scripts wrote. Throws on anything else: the keys of the namespace belong to the store. */
export function parseJobRecord(raw: string): RedisJobRecord {
  const parsed: unknown = JSON.parse(raw);

  if (!isJobRecord(parsed)) {
    throw new TypeError('A background job record of Redis does not have the shape the store writes.');
  }

  return parsed;
}

function isJobRecord(value: unknown): value is RedisJobRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const fields = ['id', 'name', 'queue', 'payload', 'enqueuedBy', 'status'].map((field): unknown =>
    Reflect.get(value, field),
  );

  const instants = ['attempts', 'runAt', 'enqueuedAt', 'seq'].map((field): unknown => Reflect.get(value, field));

  return fields.every((field) => typeof field === 'string') && instants.every((field) => typeof field === 'number');
}
