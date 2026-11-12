import { Criteria, cursorPage, scoped, type EventStamp } from '@ddd-ts-kit/kernel';
import type { CriteriaContractRow } from '../criteria/criteria-contract-row';
import { criteriaContractRows } from '../criteria/criteria-contract-rows';
import { everything } from './everything';
import { ReadModelStoreSuite } from './read-model-store-suite';
import { rowOf as row } from './row-of';
import { stampedAt as at } from './stamped-at';

type Row = CriteriaContractRow;

/**
 * Rows that round trip, events applied once and in order, a change that says when its row is missing,
 * and searching. `DeletionsSuite` holds the deletions.
 */
export class RowsSuite extends ReadModelStoreSuite {
  protected tests(): void {
    this.closesAfterEach();
    this.keepsRows();
    this.appliesInOrder();
    this.changesARowItHolds();
    this.findsNoRowToChange();
    this.appliesByVersion();
    this.ordersEachKindOfStamp();
    this.deletesOutsideTheHistory();
    this.replacesOnTheWholeStamp();
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

  private changesARowItHolds(): void {
    this.it('changes the row it holds, and is stale when the row holds this event or a later one', async () => {
      await this.put(row('a1'), at('evt-1', 1));

      this.expect(await this.store.updateIfNewer('a1', at('evt-3', 3), moreSeats)).toBe('applied');
      this.expect(await this.store.updateIfNewer('a1', at('evt-3', 3), moreSeats)).toBe('stale');
      this.expect(await this.store.updateIfNewer('a1', at('evt-2', 2), moreSeats)).toBe('stale');
      this.expect(await this.store.get('a1')).toEqual({ ...row('a1'), seats: 3 });
    });

    this.it('is stale when a change meets the trace of a deletion that is not older than it', async () => {
      await this.put(row('a1'), at('evt-1', 1));
      await this.store.delete('a1', at('evt-3', 3));

      this.expect(await this.store.updateIfNewer('a1', at('evt-2', 2), moreSeats)).toBe('stale');
      this.expect(await this.store.updateIfNewer('a1', at('evt-3', 3), moreSeats)).toBe('stale');
      this.expect(await this.store.get('a1')).toBe(undefined);
    });
  }

  private findsNoRowToChange(): void {
    this.it('answers missing for a change delivered before its creation, then applies it after it', async () => {
      this.expect(await this.store.updateIfNewer('a1', at('evt-2', 2), moreSeats)).toBe('missing');
      this.expect(await this.subject.table.find('a1')).toBe(undefined);

      this.expect(await this.put(row('a1'), at('evt-1', 1))).toBe('applied');
      this.expect(await this.store.updateIfNewer('a1', at('evt-2', 2), moreSeats)).toBe('applied');
      this.expect(await this.store.get('a1')).toEqual({ ...row('a1'), seats: 3 });
    });

    this.it('answers missing for a change later than the deletion of its row, and leaves the trace', async () => {
      await this.store.delete('a1', at('evt-1', 1));

      this.expect(await this.store.updateIfNewer('a1', at('evt-3', 3), moreSeats)).toBe('missing');
      this.expect(await this.subject.table.find('a1')).toEqual({ key: 'a1', row: undefined, stamp: at('evt-1', 1) });

      await this.put(row('a1'), at('evt-2', 2));

      this.expect(await this.store.updateIfNewer('a1', at('evt-3', 3), moreSeats)).toBe('applied');
    });
  }

  private appliesByVersion(): void {
    this.it('orders by version when both stamps carry one, whatever the clocks say', async () => {
      await this.put({ ...row('a1'), title: 'v2' }, { ...at('evt-2', 5), version: 2 });

      this.expect(await this.put({ ...row('a1'), title: 'v1' }, { ...at('evt-1', 9), version: 1 })).toBe('stale');
      this.expect(await this.put({ ...row('a1'), title: 'v3' }, { ...at('evt-3', 1), version: 3 })).toBe('applied');
      this.expect((await this.store.get('a1'))?.title).toBe('v3');
    });

    this.it(
      'keeps the instant of a stamp to the millisecond, so the next event of the key replaces the row',
      async () => {
        const first = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.123Z') };
        const second = { eventId: 'evt-2', occurredAt: new Date('2026-10-10T12:00:00.456Z') };

        await this.put(row('a1'), first);

        this.expect((await this.subject.table.find('a1'))?.stamp).toEqual(first);
        this.expect(await this.put({ ...row('a1'), seats: 7 }, second)).toBe('applied');
        this.expect(await this.put({ ...row('a1'), seats: 9 }, first)).toBe('stale');
        this.expect((await this.store.get('a1'))?.seats).toBe(7);
      },
    );

    this.it('keeps the version with the row', async () => {
      await this.put(row('a1'), { ...at('evt-1', 1), version: 7 });

      this.expect((await this.subject.table.find('a1'))?.stamp).toEqual({ ...at('evt-1', 1), version: 7 });
    });
  }

  private ordersEachKindOfStamp(): void {
    const kinds: [string, EventStamp[]][] = [
      ['without a version', [at('evt-1', 1), at('evt-2', 2), at('evt-3', 3)]],
      ['with a version', [versioned('evt-1', 3, 1), versioned('evt-2', 2, 2), versioned('evt-3', 1, 3)]],
    ];

    for (const [kind, stamps] of kinds) {
      this.it(`ends on the latest of three events ${kind}, whatever the order of their deliveries`, async () => {
        const ends: (number | undefined)[] = [];

        for (const [index, order] of permutationsOf(stamps).entries()) {
          const key = `a${String(index + 1)}`;

          for (const stamp of order) {
            await this.put({ ...row(key), seats: stamps.indexOf(stamp) + 1 }, stamp);
          }

          ends.push((await this.store.get(key))?.seats);
        }

        this.expect(ends).toEqual([3, 3, 3, 3, 3, 3]);
      });
    }
  }

  private deletesOutsideTheHistory(): void {
    this.it('removes a row of versioned events by a deletion stamped at the clock, as an erasure is', async () => {
      await this.put(row('a1'), versioned('evt-1', 1, 4));

      this.expect(await this.store.delete('a1', at('evt-5', 5))).toBe('applied');
      this.expect(await this.put(row('a1'), versioned('evt-2', 2, 5))).toBe('stale');
      this.expect(await this.store.updateIfNewer('a1', versioned('evt-6', 6, 6), moreSeats)).toBe('missing');
      this.expect(await this.store.get('a1')).toBe(undefined);
    });
  }

  private replacesOnTheWholeStamp(): void {
    this.it('replaces a row only when it still holds the whole stamp, its version included', async () => {
      const { table } = this.subject;
      const next = { key: 'a1', row: { ...row('a1'), title: 'next' }, stamp: versioned('evt-2', 2, 5) };

      await table.insert({ key: 'a1', row: row('a1'), stamp: versioned('evt-1', 1, 2) });

      this.expect(await table.replace(next, versioned('evt-1', 1, 3))).toBe(false);
      this.expect(await table.replace(next, at('evt-1', 1))).toBe(false);
      this.expect(await table.replace(next, versioned('evt-1', 1, 2))).toBe(true);
      this.expect((await this.store.get('a1'))?.title).toBe('next');
    });

    this.it('replaces a row that holds no version only on a stamp that has none', async () => {
      const { table } = this.subject;
      const next = { key: 'a1', row: { ...row('a1'), title: 'next' }, stamp: at('evt-2', 2) };

      await table.insert({ key: 'a1', row: row('a1'), stamp: at('evt-1', 1) });

      this.expect(await table.replace(next, versioned('evt-1', 1, 0))).toBe(false);
      this.expect(await table.replace(next, at('evt-1', 1))).toBe(true);
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

function moreSeats(current: Row): Row {
  return { ...current, seats: current.seats + 1 };
}

function versioned(eventId: string, minute: number, version: number): EventStamp {
  return { ...at(eventId, minute), version };
}

function permutationsOf<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [[...items]];
  }

  return items.flatMap((item, index) =>
    permutationsOf([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}
