import type { StoredData } from './stored-data.js';
import type { StoredJson } from './stored-json.js';

/** Whether a stored value is an object, not a list nor a scalar. */
export function isStoredData(value: StoredJson | undefined): value is StoredData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
