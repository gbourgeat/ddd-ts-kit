import { Criteria, cursorPage, scoped } from '@ddd-ts-kit/kernel';
import type { CriteriaContractRow } from '../criteria/criteria-contract-row';
import { criteriaContractRows } from '../criteria/criteria-contract-rows';
import { everything } from './everything';
import { ReadModelStoreSuite } from './read-model-store-suite';
import { rowOf as row } from './row-of';
import { stampedAt as at } from './stamped-at';

type Row = CriteriaContractRow;

/** Rows that round trip, events applied once and in order, and searching. `DeletionsSuite` holds the deletions. */
export class RowsSuite extends ReadModelStoreSuite {
  protected tests(): void {
    this.closesAfterEach();
    this.keepsRows();
    this.appliesInOrder();
    this.appliesByVersion();
    this.searches();
  }

  private keepsRows(): void {
    this.it('answers nothing for a key it does not hold', async () => {
      this.expect(await this.store.get('a1')).toBe(undefined);
    });

    this.it('gives back every row as it was written: instants, decimals, booleans and nulls', async () => {
      for (const row of criteriaContractRows()) {
        this.expect(await this.put(row, at('evt-1', 1))).toBe('applied');
      }

      for (const row of criteriaContractRows()) {
        this.expect(await this.store.get(row.id)).toEqual(row);
      }
    });

    this.it('hands the current row to the change of a later event', async () => {
      await this.put(row('a1'), at('evt-1', 1));

      const written = await this.store.upsertIfNewer('a1', at('evt-2', 2), (current) =>
        current === undefined ? undefined : { ...current, seats: current.seats + 1 },
      );

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

      await Promise.all(
        minutes.map((minute) => this.put({ ...row('a1'), seats: minute }, at(`evt-${String(minute)}`, minute))),
      );

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

  private searches(): void {
    this.it('searches by criteria, without the deleted rows', async () => {
      for (const written of criteriaContractRows()) {
        await this.put(written, at('evt-1', 1));
      }

      await this.store.delete('a8', at('evt-2', 2));

      const booked = Criteria.of<Row>().where('status', 'eq', 'booked').orderBy('seats', 'desc');
      const page = await this.store.search(scoped(booked, everything));

      this.expect(page.items.map(({ id }) => id)).toEqual(['a7', 'a1', 'a4']);
      this.expect(page.total).toBe(3);
    });

    this.it('pages by cursor and narrows by the scope of the actor', async () => {
      for (const written of criteriaContractRows()) {
        await this.put(written, at('evt-1', 1));
      }

      const acme = (cursor?: string) =>
        this.store.search(
          scoped(
            Criteria.of<Row>().page(cursorPage({ limit: 3, ...(cursor === undefined ? {} : { cursor }) })),
            { kind: 'filter', filter: { tenantId: 'acme' } },
            { filter: { tenantId: 'tenantId' } },
          ),
        );

      const first = await acme();
      const second = await acme(first.nextCursor);

      this.expect([first, second].map((page) => page.items.map(({ id }) => id))).toEqual([
        ['a1', 'a2', 'a3'],
        ['a6', 'a7'],
      ]);

      this.expect((await this.store.search(scoped(Criteria.of<Row>(), { kind: 'none' }))).items).toEqual([]);
    });
  }
}
