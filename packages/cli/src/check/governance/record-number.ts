/** The number held by the `adr` field of a deviation: its first run of digits (`7`, `0007`, `ADR-0007`, `docs/adr/0007-slug.md`). */
export function recordNumber(field: string): number | undefined {
  const digits = /\d+/.exec(field)?.[0];

  return digits === undefined ? undefined : Number.parseInt(digits, 10);
}
