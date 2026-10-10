const REFERENCE = /\badr[-/ ]?(\d+)/i;

/** The number of the first decision record a free text refers to: `ADR-0007`, `ADR-7`, `ADR 7`, `adr7`, `docs/adr/0007-slug.md`. */
export function referencedRecord(text: string): number | undefined {
  const digits = REFERENCE.exec(text)?.[1];

  return digits === undefined ? undefined : Number.parseInt(digits, 10);
}
