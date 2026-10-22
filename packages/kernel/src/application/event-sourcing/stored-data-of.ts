import { isStoredData } from './is-stored-data';
import type { StoredData } from './stored-data';
import type { StoredJson } from './stored-json';

/**
 * The JSON an event store keeps for what `encode` answered: a date becomes its ISO text, a field
 * holding `undefined` is left out. Anything else that is not plain data (a class instance, a
 * function, a number that is not finite) is refused with a TypeError: encode maps value objects
 * to their fields, the store never guesses.
 */
export function storedDataOf(value: object): StoredData {
  const json = jsonOf(value, 'data');

  if (!isStoredData(json)) {
    throw new TypeError('The data of a stored event is an object');
  }

  return json;
}

function jsonOf(value: unknown, path: string): StoredJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item: unknown, index) => jsonOf(item, `${path}[${index}]`));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, field]: [string, unknown]) =>
        field === undefined ? [] : [[key, jsonOf(field, `${path}.${key}`)]],
      ),
    );
  }

  throw new TypeError(
    `${path} is not plain data: map it to strings, numbers, booleans, dates, arrays and plain objects`,
  );
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
