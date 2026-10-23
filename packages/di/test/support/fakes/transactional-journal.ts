import type { Transactional } from './transactional-unit-of-work';

/** Lines written in a transaction: kept on commit, forgotten on roll back, refused outside one. */
export class TransactionalJournal implements Transactional {
  private readonly kept: string[] = [];

  private pending: string[] | undefined;

  constructor(private readonly what: string) {}

  begin(): void {
    this.pending = [];
  }

  commit(): void {
    this.kept.push(...(this.pending ?? []));
    this.pending = undefined;
  }

  rollBack(): void {
    this.pending = undefined;
  }

  write(line: string): void {
    if (this.pending === undefined) {
      throw new Error(`${this.what} written outside a unit of work: ${line}`);
    }

    this.pending.push(line);
  }

  /** Whether the line is kept, or written in the transaction that is open. */
  has(line: string): boolean {
    return this.kept.includes(line) || (this.pending?.includes(line) ?? false);
  }

  /** What survived its transaction. */
  lines(): readonly string[] {
    return [...this.kept];
  }
}
