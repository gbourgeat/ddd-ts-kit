import { isJsonObject } from './is-json-object';

/** A member of a JSON object, `undefined` for anything else. */
export function fieldOf(value: unknown, name: string): unknown {
  return isJsonObject(value) ? value[name] : undefined;
}
