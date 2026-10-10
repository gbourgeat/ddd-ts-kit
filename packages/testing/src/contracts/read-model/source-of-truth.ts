import { pageOf, type Page, type ReadModelSource, type StampedRow } from '@ddd-ts-kit/kernel';

/**
 * The fake of the context a read model is rebuilt from: rows by key, exported two at a time,
 * and counting how it was read. `duringExport` runs between two pages, which is where a test
 * makes an event arrive.
 */
export class SourceOfTruth<Row> implements ReadModelSource<Row> {
  readonly lookups: string[][] = [];

  exportedPages = 0;

  duringExport: (page: number) => Promise<void> = () => Promise.resolve();

  private readonly rows = new Map<string, StampedRow<Row>>();

  put(entry: StampedRow<Row>): void {
    this.rows.set(entry.key, entry);
  }

  remove(key: string): void {
    this.rows.delete(key);
  }

  async export(cursor: string | undefined): Promise<Page<StampedRow<Row>>> {
    if (cursor !== undefined) await this.duringExport(this.exportedPages);

    const after = [...this.rows.keys()].sort().filter((key) => cursor === undefined || key > cursor);
    const keys = after.slice(0, 2);
    const last = keys.at(-1);

    this.exportedPages += 1;

    return pageOf(keys.flatMap((key) => this.rows.get(key) ?? []), after.length > 2 && last !== undefined ? { nextCursor: last } : {});
  }

  async lookup(keys: readonly string[]): Promise<ReadonlyMap<string, StampedRow<Row>>> {
    this.lookups.push([...keys]);

    return new Map(keys.flatMap((key) => {
      const entry = this.rows.get(key);

      return entry === undefined ? [] : [[key, entry]];
    }));
  }
}
