/** What a JSON value holds under a path of keys; `undefined` as soon as a step is not an object. */
export function jsonAt(value: unknown, ...keys: readonly string[]): unknown {
  let current = value;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    current = Reflect.get(current, key);
  }

  return current;
}
