import type { ReadModelTable } from '../../application/ports/read-model-table.js';
import type { UnitOfWork } from '../../application/ports/unit-of-work.js';
import type { ProjectionRebuildReport } from '../../application/read-model/projection-rebuild-report.js';
import type { ReadModelSource } from '../../application/read-model/read-model-source.js';
import type { TouchedKey } from '../../application/read-model/touched-key.js';
import { writeIfNewer } from './write-if-newer.js';

export interface ProjectionRebuildParts<Row> {
  readonly table: ReadModelTable<Row>;
  readonly source: ReadModelSource<Row>;
  /** The unit of work of the table's database: the swap is one transaction. */
  readonly unitOfWork: UnitOfWork;
  /** Touched keys read again per round. Default 500. */
  readonly batchSize?: number;
  /** The swap starts once a round finds no more touched keys than this. Default 50. */
  readonly settledBelow?: number;
  /** Rounds after which the swap starts anyway, holding the writers for what remains. Default 20. */
  readonly maxRounds?: number;
}

/**
 * Rebuilds a read model from its source of truth, without an event store and without stopping
 * the projection. The copy is filled from the export alone; every key an event writes
 * meanwhile is read again from the source; the last of them are read with the writers held,
 * in the transaction that puts the copy in place of the table.
 */
export class ProjectionRebuild<Row> {
  constructor(private readonly parts: ProjectionRebuildParts<Row>) {}

  async run(): Promise<ProjectionRebuildReport> {
    const { table, unitOfWork } = this.parts;

    await table.abandonRebuild();
    await table.beginRebuild();

    try {
      const copied = await this.copy();
      const caughtUp = await this.catchUp();
      const held = await unitOfWork.run(() => this.swap());

      return { copied, reread: caughtUp.reread + held, rounds: caughtUp.rounds };
    } catch (error) {
      await table.abandonRebuild();

      throw error;
    }
  }

  private async copy(): Promise<number> {
    const { table, source } = this.parts;
    let copied = 0;
    let cursor: string | undefined;

    do {
      const page = await source.export(cursor);

      for (const { key, row, stamp } of page.items) {
        await writeIfNewer(table.shadow(), { key, stamp, next: () => row });
      }

      copied += page.items.length;
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    return copied;
  }

  private async catchUp(): Promise<Pick<ProjectionRebuildReport, 'reread' | 'rounds'>> {
    const { table, batchSize = 500, settledBelow = 50, maxRounds = 20 } = this.parts;
    let reread = 0;
    let rounds = 0;

    for (; rounds < maxRounds; rounds += 1) {
      const keys = await table.touched(batchSize);

      if (keys.length <= settledBelow) {
        break;
      }

      reread += await this.readAgain(keys);
    }

    return { reread, rounds };
  }

  private async swap(): Promise<number> {
    const { table, batchSize = 500 } = this.parts;
    let reread = 0;

    await table.holdWriters();

    for (let keys = await table.touched(batchSize); keys.length > 0; keys = await table.touched(batchSize)) {
      reread += await this.readAgain(keys);
    }

    await table.promote();

    return reread;
  }

  private async readAgain(keys: readonly TouchedKey[]): Promise<number> {
    const { table, source } = this.parts;
    const found = await source.lookup(keys.map(({ key }) => key));

    for (const { key } of keys) {
      const entry = found.get(key);

      if (entry === undefined) {
        await this.forget(key);
      } else {
        await writeIfNewer(table.shadow(), { key, stamp: entry.stamp, next: () => entry.row });
      }
    }

    await table.settle(keys);

    return keys.length;
  }

  /** The source no longer has the row: the copy takes the trace the table holds of its deletion, if it has one. */
  private async forget(key: string): Promise<void> {
    const live = await this.parts.table.find(key);

    if (live !== undefined && live.row === undefined) {
      await writeIfNewer(this.parts.table.shadow(), { key, stamp: live.stamp });
    }
  }
}
