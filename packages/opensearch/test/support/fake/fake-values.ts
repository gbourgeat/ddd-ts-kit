type Source = Readonly<Record<string, unknown>>;

/** The mapping of a field, as the fake reads it. */
export interface FakeProperty {
  readonly type?: string;
  readonly enabled?: boolean;
  readonly properties?: Readonly<Record<string, FakeProperty>>;
}

/** The value at a dotted path of a document, `undefined` when it holds none. */
export function valueAt(source: Source, path: string): unknown {
  return path.split('.').reduce<unknown>((value, name) => {
    return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
  }, source);
}

/** The type the mapping gives a dotted path: `keyword` for a path it does not know. */
export function typeAt(properties: Readonly<Record<string, FakeProperty>>, path: string): string {
  const [name = '', ...rest] = path.split('.');
  const property = properties[name];

  if (rest.length === 0 || property?.properties === undefined) {
    return property?.type ?? 'keyword';
  }

  return typeAt(property.properties, rest.join('.'));
}

/**
 * The order of two values of a field as an index of OpenSearch orders them: a keyword by its bytes
 * (the order of the code points), a number by value, a date by its instant, `false` before `true`.
 */
export function compareAs(type: string, left: unknown, right: unknown): number {
  switch (type) {
    case 'double':
      return Number(left) - Number(right);
    case 'date':
      return Date.parse(String(left)) - Date.parse(String(right));
    case 'boolean':
      return Number(left === true || left === 'true') - Number(right === true || right === 'true');
    default:
      return codePoints(String(left), String(right));
  }
}

function codePoints(left: string, right: string): number {
  const a = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const b = Array.from(right, (character) => character.codePointAt(0) ?? 0);

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return a.length - b.length;
}
