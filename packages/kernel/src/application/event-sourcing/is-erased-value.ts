import { isStoredData } from './is-stored-data';
import type { StoredJson } from './stored-json';

/** Whether a stored value is a personal value whose key was destroyed: an `ErasedValue`. */
export function isErasedValue(value: StoredJson | undefined): boolean {
  if (!isStoredData(value) || Object.keys(value).length !== 1) {
    return false;
  }

  const marked = value['$erased'];

  return isStoredData(marked) && typeof marked['key'] === 'string';
}
