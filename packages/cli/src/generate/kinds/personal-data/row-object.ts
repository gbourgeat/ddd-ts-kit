/** An object literal written over several lines, which the formatter keeps as it is: one property per line. */
export function rowObject(entries: readonly (readonly [key: string, value: string])[]): string {
  return `{\n${entries.map(([key, value]) => `  ${key}: ${value},`).join('\n')}\n}`;
}
