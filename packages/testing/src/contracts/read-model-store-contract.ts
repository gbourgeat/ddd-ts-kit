import {
  Criteria,
  ProjectionRebuild,
  TableReadModelStore,
  cursorPage,
  scoped,
  type EventStamp,
  type ProjectionRebuildReport,
  type ReadModelTable,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';
import { criteriaContractDefinition } from './criteria/criteria-contract-definition.js';
import type { CriteriaContractRow } from './criteria/criteria-contract-row.js';
import { criteriaContractRows } from './criteria/criteria-contract-rows.js';
import { rowOf as row } from './read-model/row-of.js';
import { stampedAt as at } from './read-model/stamped-at.js';
import { SourceOfTruth } from './read-model/source-of-truth.js';

type Row = CriteriaContractRow;

export interface ReadModelStoreUnderContract {
  /** The table of `CriteriaContractRow`, empty. */
  readonly table: ReadModelTable<Row>;
  /** The unit of work of its database: the swap of a rebuild runs in it. */
  readonly unitOfWork: UnitOfWork;
  close?(): Awaitable<void>;
}

export interface ReadModelStoreContractOptions {
  readonly name: string;
  /** Called before each test. */
  createTable(): Awaitable<ReadModelStoreUnderContract>;
}

const everything = { kind: 'all' } as const;

/**
 * What every adapter of `ReadModelTable` guarantees under `TableReadModelStore`, the
 * in-memory one included: rows that round trip, events applied once and in order whatever
 * the order of their delivery, deletions that last, and a rebuild that loses no event.
 */
export function readModelStoreContract(runner: ContractRunner, options: ReadModelStoreContractOptions): void {
  new ReadModelStoreSuite(runner, options).describe(`${options.name} (read model store contract)`);
}

class ReadModelStoreSuite extends ContractSuite<ReadModelStoreUnderContract> {
  constructor(runner: ContractRunner, options: ReadModelStoreContractOptions) {
    super(runner, () => options.createTable());
  }

  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });

    this.keepsRows();
    this.appliesInOrder();
    this.appliesByVersion();
    this.deletes();
    this.lists();
    this.rebuilds();
    this.rebuildsUnderEvents();
    this.appliesAfterTheSwap();
    this.rebuildsAroundDeletions();
    this.survivesARebuild();
  }

  private keepsRows(): void {
    this.it('answers nothing for a key it does not hold', async () => {
      this.expect(await this.store.get('a1')).toBe(undefined);
    });

    this.it('gives back every row as it was written: instants, decimals, booleans and nulls', async () => {
      for (const row of criteriaContractRows()) this.expect(await this.put(row, at('evt-1', 1))).toBe('applied');

      for (const row of criteriaContractRows()) this.expect(await this.store.get(row.id)).toEqual(row);
    });

    this.it('hands the current row to the change of a later event', async () => {
      await this.put(row('a1'), at('evt-1', 1));

      const written = await this.store.upsertIfNewer('a1', at('evt-2', 2), (current) => (current === undefined ? undefined : { ...current, seats: current.seats + 1 }));

      this.expect(written).toBe('applied');
      this.expect(await this.store.get('a1')).toEqual({ ...row('a1'), seats: 3 });
    });

    this.it('writes nothing when the change answers nothing', async () => {
      this.expect(await this.store.upsertIfNewer('a1', at('evt-1', 1), () => undefined)).toBe('ignored');
      this.expect(await this.store.get('a1')).toBe(undefined);
    });
  }

  private appliesInOrder(): void {
    this.it('ignores an event delivered twice', async () => {
      await this.put(row('a1'), at('evt-1', 1));

      this.expect(await this.put({ ...row('a1'), title: 'again' }, at('evt-1', 1))).toBe('stale');
      this.expect(await this.store.get('a1')).toEqual(row('a1'));
    });

    this.it('ignores an event older than what the row holds', async () => {
      await this.put(row('a1'), at('evt-2', 2));

      this.expect(await this.put({ ...row('a1'), title: 'late' }, at('evt-1', 1))).toBe('stale');
      this.expect(await this.store.get('a1')).toEqual(row('a1'));
    });

    this.it('orders two events of the same instant by their id, whichever comes first', async () => {
      await this.put({ ...row('a1'), title: 'b' }, at('evt-b', 1));

      this.expect(await this.put({ ...row('a1'), title: 'a' }, at('evt-a', 1))).toBe('stale');
      this.expect(await this.put({ ...row('a1'), title: 'c' }, at('evt-c', 1))).toBe('applied');
      this.expect((await this.store.get('a1'))?.title).toBe('c');
    });

    this.it('ends on the latest of several events applied at once', async () => {
      const minutes = [3, 1, 4, 2];

      await Promise.all(minutes.map((minute) => this.put({ ...row('a1'), seats: minute }, at(`evt-${String(minute)}`, minute))));

      this.expect((await this.store.get('a1'))?.seats).toBe(4);
    });
  }

  private appliesByVersion(): void {
    this.it('orders by version when both stamps carry one, whatever the clocks say', async () => {
      await this.put({ ...row('a1'), title: 'v2' }, { ...at('evt-2', 5), version: 2 });

      this.expect(await this.put({ ...row('a1'), title: 'v1' }, { ...at('evt-1', 9), version: 1 })).toBe('stale');
      this.expect(await this.put({ ...row('a1'), title: 'v3' }, { ...at('evt-3', 1), version: 3 })).toBe('applied');
      this.expect((await this.store.get('a1'))?.title).toBe('v3');
    });

    this.it('keeps the version with the row', async () => {
      await this.put(row('a1'), { ...at('evt-1', 1), version: 7 });

      this.expect((await this.subject.table.find('a1'))?.stamp).toEqual({ ...at('evt-1', 1), version: 7 });
    });
  }

  private deletes(): void {
    this.it('removes a row, and an older event delivered late does not bring it back', async () => {
      await this.put(row('a1'), at('evt-1', 1));

      this.expect(await this.store.delete('a1', at('evt-3', 3))).toBe('applied');
      this.expect(await this.store.get('a1')).toBe(undefined);
      this.expect(await this.put(row('a1'), at('evt-2', 2))).toBe('stale');
      this.expect(await this.store.get('a1')).toBe(undefined);
    });

    this.it('writes a row again when a later event recreates it', async () => {
      await this.put(row('a1'), at('evt-1', 1));
      await this.store.delete('a1', at('evt-2', 2));

      this.expect(await this.put({ ...row('a1'), title: 'back' }, at('evt-3', 3))).toBe('applied');
      this.expect((await this.store.get('a1'))?.title).toBe('back');
    });

    this.it('ignores a deletion older than the row, or of a row it never held', async () => {
      await this.put(row('a1'), at('evt-2', 2));

      this.expect(await this.store.delete('a1', at('evt-1', 1))).toBe('stale');
      this.expect(await this.store.delete('a2', at('evt-1', 1))).toBe('ignored');
      this.expect(await this.store.get('a1')).toEqual(row('a1'));
    });
  }

  private lists(): void {
    this.it('lists by criteria, without the deleted rows', async () => {
      for (const written of criteriaContractRows()) await this.put(written, at('evt-1', 1));

      await this.store.delete('a8', at('evt-2', 2));

      const booked = Criteria.of<Row>().where('status', 'eq', 'booked').orderBy('seats', 'desc');
      const page = await this.store.list(scoped(booked, everything));

      this.expect(page.items.map(({ id }) => id)).toEqual(['a7', 'a1', 'a4']);
      this.expect(page.total).toBe(3);
    });

    this.it('pages by cursor and narrows by the scope of the actor', async () => {
      for (const written of criteriaContractRows()) await this.put(written, at('evt-1', 1));

      const acme = (cursor?: string) =>
        this.store.list(scoped(Criteria.of<Row>().page(cursorPage({ limit: 3, ...(cursor === undefined ? {} : { cursor }) })), { kind: 'filter', filter: { tenantId: 'acme' } }, { filter: { tenantId: 'tenantId' } }));

      const first = await acme();
      const second = await acme(first.nextCursor);

      this.expect([first, second].map((page) => page.items.map(({ id }) => id))).toEqual([['a1', 'a2', 'a3'], ['a6', 'a7']]);
      this.expect((await this.store.list(scoped(Criteria.of<Row>(), { kind: 'none' }))).items).toEqual([]);
    });
  }

  private rebuilds(): void {
    this.it('rebuilds from the source alone: wrong rows are corrected, rows the source does not hold are gone', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4', 'a5'], 2);

      await this.put({ ...row('a1'), title: 'wrong' }, at('evt-1', 1));
      await this.put(row('a2'), at('evt-1', 1));

      const report = await this.rebuild(source);

      this.expect(report).toEqual({ copied: 4, reread: 0, rounds: 0 });
      this.expect(source.exportedPages).toBe(2);
      this.expect(await this.ids()).toEqual(['a1', 'a3', 'a4', 'a5']);
      this.expect(await this.store.get('a1')).toEqual(row('a1'));
      this.expect(await this.subject.table.rebuilding()).toBe(false);
    });

    this.it('leaves the table as it was when the export fails', async () => {
      const source = this.sourceOf(['a1', 'a3', 'a4'], 2);

      source.duringExport = () => Promise.reject(new Error('the source is down'));
      await this.put(row('a2'), at('evt-1', 1));

      this.expect(await this.rebuild(source).then(() => 'rebuilt', () => 'failed')).toBe('failed');
      this.expect(await this.ids()).toEqual(['a2']);
      this.expect(await this.subject.table.rebuilding()).toBe(false);
      this.expect(await this.put(row('a5'), at('evt-2', 2))).toBe('applied');
    });
  }

  private rebuildsUnderEvents(): void {
    for (const key of ['a1', 'a5']) {
      this.it(`loses no event applied while it exports, ${key === 'a1' ? 'on a row already copied' : 'on a row not copied yet'}`, async () => {
        const source = this.sourceOf(['a1', 'a3', 'a4', 'a5'], 2);
        const renamed = { ...row(key), title: 'renamed meanwhile' };

        source.duringExport = async () => {
          source.put({ key, row: renamed, stamp: at('evt-9', 9) });
          await this.store.upsertIfNewer(key, at('evt-9', 9), (current) => (current === undefined ? undefined : renamed));
        };

        const report = await this.rebuild(source);

        this.expect(await this.store.get(key)).toEqual(renamed);
        this.expect(source.lookups).toEqual([[key]]);
        this.expect(report.reread).toBe(1);
      });
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

  private survivesARebuild(): void {
    this.it('is the same table after two rebuilds: keys stay unique, rows are written and listed', async () => {
      await this.rebuild(this.sourceOf(['a1', 'a3'], 2));
      await this.rebuild(this.sourceOf(['a1', 'a3', 'a4'], 3));

      this.expect(await this.subject.table.insert({ key: 'a4', row: row('a4'), stamp: at('evt-9', 9) })).toBe(false);
      this.expect(await this.put(row('a5'), at('evt-9', 9))).toBe('applied');
      this.expect(await this.ids()).toEqual(['a1', 'a3', 'a4', 'a5']);
    });
  }

  private get store(): TableReadModelStore<Row> {
    return new TableReadModelStore(this.subject.table, criteriaContractDefinition);
  }

  private put(written: Row, stamp: EventStamp): Promise<string> {
    return this.store.upsertIfNewer(written.id, stamp, () => written);
  }

  private rebuild(source: SourceOfTruth<Row>): Promise<ProjectionRebuildReport> {
    const { table, unitOfWork } = this.subject;

    return new ProjectionRebuild({ table, source, unitOfWork }).run();
  }

  private async ids(): Promise<string[]> {
    const page = await this.store.list(scoped(Criteria.of<Row>().orderBy('id'), everything));

    return page.items.map(({ id }) => id);
  }

  /** A source holding these rows of the dataset, each stamped at the minute given. */
  private sourceOf(keys: readonly string[], minute: number): SourceOfTruth<Row> {
    const source = new SourceOfTruth<Row>();

    for (const key of keys) source.put({ key, row: row(key), stamp: at(`evt-${String(minute)}`, minute) });

    return source;
  }
}
