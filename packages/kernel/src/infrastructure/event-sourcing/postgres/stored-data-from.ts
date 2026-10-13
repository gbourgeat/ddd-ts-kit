import type { StoredData } from '../../../application/event-sourcing/stored-data.js';
import type { StoredJson } from '../../../application/event-sourcing/stored-json.js';
import { UnreadableEventError } from '../../../application/event-sourcing/unreadable-event-error.js';

/** A `jsonb` column as the driver answered it, parsed when it came back as text, checked to be a JSON object. */
export function storedDataFrom(value: unknown, where: string): StoredData {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;

  if (!isJsonObject(parsed)) {
    throw new UnreadableEventError(`${where} is not a JSON object`);
  }

  return parsed;
}

function isJsonObject(value: unknown): value is StoredData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return (prototype === Object.prototype || prototype === null) && Object.values(value).every(isJson);
}

function isJson(value: unknown): value is StoredJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return true;
  }

  return Array.isArray(value) ? value.every(isJson) : isJsonObject(value);
}
