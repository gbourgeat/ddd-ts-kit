import fs from 'node:fs';
import path from 'node:path';
import { ADR_DIRECTORY } from './adr-directory';
import { recordNumber } from './record-number';

const RECORD_FILE = /^(\d+)-.+\.md$/;

/** The decision records of a project, `docs/adr/<number>-<slug>.md`, listed once and only when asked. */
export class DecisionRecords {
  private numbers: ReadonlySet<number> | undefined;

  constructor(private readonly root: string) {}

  has(number: number): boolean {
    this.numbers ??= this.list();

    return this.numbers.has(number);
  }

  private list(): ReadonlySet<number> {
    try {
      const entries = fs.readdirSync(path.join(this.root, ADR_DIRECTORY));

      return new Set(entries.flatMap((entry) => recordNumber(RECORD_FILE.exec(entry)?.[1] ?? '') ?? []));
    } catch {
      return new Set();
    }
  }
}
