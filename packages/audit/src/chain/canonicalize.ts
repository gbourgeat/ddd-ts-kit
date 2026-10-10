/**
 * The canonical form the hash is computed over, so that any program can compute it again:
 * JSON without whitespace, the keys of every object sorted by UTF-16 code unit (the order of
 * `Array.prototype.sort`), a property whose value is `undefined` left out, a date written in
 * ISO 8601 UTC with milliseconds, numbers and strings as `JSON.stringify` writes them.
 */
export function canonicalize(value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    return canonicalObject(value);
  }

  return JSON.stringify(value ?? null);
}

function canonicalObject(value: object): string {
  const members = Object.entries(value)
    .filter(([, member]) => member !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([key, member]) => `${JSON.stringify(key)}:${canonicalize(member)}`);

  return `{${members.join(',')}}`;
}
