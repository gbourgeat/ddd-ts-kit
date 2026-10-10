// Code-unit order, not locale order: generated files must not depend on the machine's locale.
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
