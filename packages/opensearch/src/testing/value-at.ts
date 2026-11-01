type Source = Readonly<Record<string, unknown>>;

/** The value at a dotted path of a document, `undefined` when it holds none. */
export function valueAt(source: Source, path: string): unknown {
  return path.split('.').reduce<unknown>((value, name) => {
    return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
  }, source);
}
