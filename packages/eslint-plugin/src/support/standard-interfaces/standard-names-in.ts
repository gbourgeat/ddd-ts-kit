/** The identifiers a replacement text names: `ExecutionContext` and `Actor` for "ExecutionContext or Actor". */
export function standardNamesIn(instead: string): string[] {
  return instead.match(/(?<![\w$@/-])[A-Z][\w$]*/g) ?? [];
}
