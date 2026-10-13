import type { StoredJson } from './stored-json.js';

/** Whether a stored value is a list. */
export function isStoredList(value: StoredJson | undefined): value is readonly StoredJson[] {
  return Array.isArray(value);
}
