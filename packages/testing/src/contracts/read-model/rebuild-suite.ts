import { ProjectionRebuild, RowNotHeldError, type ProjectionRebuildReport } from '@ddd-ts-kit/kernel';
import type { CriteriaContractRow } from '../criteria/criteria-contract-row';
import { failureOf } from '../failure-of';
import type { ReadModelStoreUnderContract } from './read-model-store-under-contract';
import { ReadModelStoreSuite } from './read-model-store-suite';
import { rowOf as row } from './row-of';
import { SourceOfTruth } from './source-of-truth';
import { stampedAt as at } from './stamped-at';

type Row = CriteriaContractRow;

/** A rebuild from the source of truth that loses no event, whatever happens while it runs. */
export class RebuildSuite extends ReadModelStoreSuite<ReadModelStoreUnderContract> {
  protected tests(): void {
    this.closesAfterEach();
    this.rebuilds();
    this.rebuildsUnderEvents();
    this.rebuildsAroundARefusedChange();
    this.appliesAfterTheSwap();
    this.rebuildsAroundDeletions();
    this.rebuildsAroundTraces();
    this.survivesARebuild();
  }

  private rebuilds(): void {
    this.it(
      'rebuilds from the source alone: wrong rows are corrected, rows the source does not hold are gone',
      async () => {
        const source = this.sourceOf(['a1', 'a3', 'a4', 'a5'], 2);

        await this.put({ ...row('a1'), title: 'wrong' }, at('evt-1', 1));
        await this.put(row('a2'), at('evt-1', 1));

        const report = await this.rebuild(source);

        this.expect(report).toEqual({ copied: 4, reread: 0, rounds: 0 });
        this.expect(source.exportedPages).toBe(2);
        this.expect(await this.ids()).toEqual(['a1', 'a3', 'a4', 'a5']);
        this.expect(await this.store.get('a1')).toEqual(row('a1'));
        this.expect(await this.subject.table.rebuilding()).toBe(false);
      },
    );

    this.it('leaves the table as it was when the export fails', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4'], 2);

      source.duringExport = () => Promise.reject(new Error('the source is down'));
      await this.put(row('a2'), at('evt-1', 1));

      this.expect((await failureOf(() => this.rebuild(source))) !== undefined).toBe(true);

      this.expect(await this.ids()).toEqual(['a2']);
      this.expect(await this.subject.table.rebuilding()).toBe(false);
      this.expect(await this.put(row('a5'), at('evt-2', 2))).toBe('applied');
    });
  }

  private rebuildsUnderEvents(): void {
    for (const key of ['a1', 'a5']) {
      this.it(
        `loses no event applied while it exports, ${key === 'a1' ? 'on a row already copied' : 'on a row not copied yet'}`,
        async () => {
          const source = this.sourceOf(['a1', 'a3', 'a4', 'a5'], 2);
          const renamed = { ...row(key), title: 'renamed meanwhile' };

          source.duringExport = async () => {
            source.put({ key, row: renamed, stamp: at('evt-9', 9) });

            await this.store.upsertIfNewer(key, at('evt-9', 9), (current) =>
              current === undefined ? undefined : renamed,
            );
          };

          const report = await this.rebuild(source);

          this.expect(await this.store.get(key)).toEqual(renamed);
          this.expect(source.lookups).toEqual([[key]]);
          this.expect(report.reread).toBe(1);
        },
      );
    }

    this.it('reads the touched keys again in rounds before it holds the writers', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4'], 2);

      source.duringExport = async () => {
        source.put({ key: 'a3', row: { ...row('a3'), seats: 9 }, stamp: at('evt-9', 9) });
        await this.put({ ...row('a3'), seats: 9 }, at('evt-9', 9));
      };

      const { table, unitOfWork } = this.subject;
      const report = await new ProjectionRebuild({ table, source, unitOfWork, settledBelow: 0 }).run();

      this.expect(report).toEqual({ copied: 3, reread: 1, rounds: 1 });
      this.expect((await this.store.get('a3'))?.seats).toBe(9);
    });
  }

  private rebuildsAroundARefusedChange(): void {
    this.it('reads again the key of a change refused while it exports, which is applied after the swap', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4', 'a5'], 2);
      const renamed = (current: Row): Row => ({ ...current, title: 'renamed' });
      const refusals: unknown[] = [];

      source.duringExport = async () => {
        refusals.push(await failureOf(() => this.store.updateIfNewer('a5', at('evt-9', 9), renamed)));
      };

      const report = await this.rebuild(source);

      this.expect(refusals.map((refusal) => refusal instanceof RowNotHeldError)).toEqual([true]);
      this.expect(report.reread).toBe(1);
      this.expect(await this.store.get('a5')).toEqual(row('a5'));
      this.expect(await this.store.updateIfNewer('a5', at('evt-9', 9), renamed)).toBe('applied');
    });
  }

  private appliesAfterTheSwap(): void {
    this.it('applies after the swap what the source did not hold yet, and only that', async () => {
      await this.rebuild(this.sourceOf(['a1', 'a3'], 5));

      this.expect(await this.put({ ...row('a1'), title: 'already in the export' }, at('evt-4', 4))).toBe('stale');
      this.expect(await this.put({ ...row('a1'), title: 'new' }, at('evt-6', 6))).toBe('applied');
      this.expect((await this.store.get('a1'))?.title).toBe('new');
    });
  }

  private rebuildsAroundDeletions(): void {
    this.it('drops a row deleted while it exports, for good', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4'], 2);

      await this.put(row('a1'), at('evt-1', 1));

      source.duringExport = async () => {
        source.remove('a1');
        await this.store.delete('a1', at('evt-9', 9));
      };

      await this.rebuild(source);

      this.expect(await this.ids()).toEqual(['a3', 'a4']);
      this.expect(await this.put(row('a1'), at('evt-5', 5))).toBe('stale');
    });

    this.it('keeps the trace of a row deleted before it started', async () => {
      await this.put(row('a2'), at('evt-1', 1));
      await this.store.delete('a2', at('evt-4', 4));
      await this.rebuild(this.sourceOf(['a1'], 2));

      this.expect(await this.put(row('a2'), at('evt-3', 3))).toBe('stale');
      this.expect(await this.put(row('a2'), at('evt-9', 9))).toBe('applied');
      this.expect(await this.ids()).toEqual(['a1', 'a2']);
    });
  }

  private rebuildsAroundTraces(): void {
    this.it('keeps deleted a row deleted while it exports, before its page was copied', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4', 'a5'], 2);

      await this.put(row('a5'), at('evt-1', 1));

      source.duringExport = async () => {
        source.remove('a5');
        await this.store.delete('a5', at('evt-9', 9));
      };

      await this.rebuild(source);

      this.expect(await this.ids()).toEqual(['a1', 'a3', 'a4']);
      this.expect(await this.put(row('a5'), at('evt-5', 5))).toBe('stale');
      this.expect(await this.put(row('a5'), at('evt-10', 10))).toBe('applied');
    });

    this.it('keeps the trace of a key it never held, written before it started or while it exports', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4'], 2);

      await this.store.delete('a2', at('evt-4', 4));

      source.duringExport = async () => {
        await this.store.delete('a6', at('evt-9', 9));
      };

      await this.rebuild(source);

      this.expect(await this.put(row('a2'), at('evt-3', 3))).toBe('stale');
      this.expect(await this.put(row('a6'), at('evt-8', 8))).toBe('stale');
      this.expect((await this.subject.table.find('a6'))?.stamp).toEqual(at('evt-9', 9));
      this.expect(await this.ids()).toEqual(['a1', 'a3', 'a4']);
    });
  }

  private survivesARebuild(): void {
    this.it('is the same table after two rebuilds: keys stay unique, rows are written and listed', async () => {
      await this.rebuild(this.sourceOf(['a1', 'a3'], 2));
      await this.rebuild(this.sourceOf(['a1', 'a3', 'a4'], 3));

      this.expect(await this.subject.table.insert({ key: 'a4', row: row('a4'), stamp: at('evt-9', 9) })).toBe(false);
      this.expect(await this.put(row('a5'), at('evt-9', 9))).toBe('applied');
      this.expect(await this.ids()).toEqual(['a1', 'a3', 'a4', 'a5']);
    });
  }

  private rebuild(source: SourceOfTruth<Row>): Promise<ProjectionRebuildReport> {
    const { table, unitOfWork } = this.subject;

    return new ProjectionRebuild({ table, source, unitOfWork }).run();
  }

  /** A source holding these rows of the dataset, each stamped at the minute given. */
  private sourceOf(keys: readonly string[], minute: number): SourceOfTruth<Row> {
    const source = new SourceOfTruth<Row>();

    for (const key of keys) {
      source.put({ key, row: row(key), stamp: at(`evt-${String(minute)}`, minute) });
    }

    return source;
  }
}
