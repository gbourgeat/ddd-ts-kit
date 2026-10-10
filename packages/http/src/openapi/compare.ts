/** Code-unit order, not locale order: the output must not depend on the machine's locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
