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

/** The order of the UTF-8 bytes, which is the order of the code points. */
function codePoints(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}
