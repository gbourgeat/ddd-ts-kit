import fs from 'node:fs';
import path from 'node:path';

export const ADR_DIRECTORY = 'docs/adr';

const REFERENCE = /\badr[-/ ]?(\d+)/i;
const RECORD_FILE = /^(\d+)-.+\.md$/;

/** The number of the first decision record a free text refers to: `ADR-0007`, `ADR-7`, `ADR 7`, `adr7`, `docs/adr/0007-slug.md`. */
export function referencedRecord(text: string): number | undefined {
  return toNumber(REFERENCE.exec(text)?.[1]);
}

/** The number held by the `adr` field of a deviation: its first run of digits (`7`, `0007`, `ADR-0007`, `docs/adr/0007-slug.md`). */
export function recordNumber(field: string): number | undefined {
  return toNumber(/\d+/.exec(field)?.[0]);
}

function toNumber(digits: string | undefined): number | undefined {
  return digits === undefined ? undefined : Number.parseInt(digits, 10);
}

/** The decision records of a project, `docs/adr/<number>-<slug>.md`, listed once and only when asked. */
export class DecisionRecords {
  #numbers: ReadonlySet<number> | undefined;

  constructor(private readonly root: string) {}

  has(number: number): boolean {
    this.#numbers ??= this.#list();
    return this.#numbers.has(number);
  }

  #list(): ReadonlySet<number> {
    let entries: string[];
    try {
      entries = fs.readdirSync(path.join(this.root, ADR_DIRECTORY));
    } catch {
      return new Set();
    }
    return new Set(entries.flatMap((entry) => toNumber(RECORD_FILE.exec(entry)?.[1]) ?? []));
  }
}
