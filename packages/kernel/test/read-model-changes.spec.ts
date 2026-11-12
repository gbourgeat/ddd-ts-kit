import { describe, expect, it } from 'vitest';
import {
  InMemoryReadModelStore,
  InMemoryReadModelTable,
  InMemoryUnitOfWork,
  ProjectionRebuild,
  ShadowReadModelStore,
  TableReadModelStore,
  defineCriteria,
  pageOf,
  type EventStamp,
  type ReadModelSource,
} from '../src';

interface VisitRow {
  readonly id: string;
  readonly room: string;
}

const visits = defineCriteria<VisitRow>({
  fields: { id: { type: 'string', sortable: true }, room: { type: 'string' } },
  tieBreaker: 'id',
});

const at = (minute: number, version?: number): EventStamp => ({
  eventId: `evt-${String(minute)}`,
  occurredAt: new Date(Date.UTC(2026, 10, 12, 9, minute)),
  ...(version === undefined ? {} : { version }),
});

const booked = (id: string): VisitRow => ({ id, room: 'A' });
const moved = (visit: VisitRow): VisitRow => ({ ...visit, room: 'B' });

describe('updateIfNewer, the change of a row another event created', () => {
  it('changes the row it holds, and is stale when the row holds this event or a later one', async () => {
    const store = new InMemoryReadModelStore(visits);

    await store.upsertIfNewer('v1', at(1), () => booked('v1'));

    expect(await store.updateIfNewer('v1', at(3), moved)).toBe('applied');
    expect(await store.updateIfNewer('v1', at(3), moved)).toBe('stale');
    expect(await store.updateIfNewer('v1', at(2), () => booked('v1'))).toBe('stale');
    expect(await store.get('v1')).toEqual({ id: 'v1', room: 'B' });
  });

  it('answers missing for a change delivered before its creation, writes nothing, and applies it after the creation', async () => {
    const store = new InMemoryReadModelStore(visits);
    const calls: VisitRow[] = [];

    const change = (visit: VisitRow): VisitRow => {
      calls.push(visit);

      return moved(visit);
    };

    expect(await store.updateIfNewer('v1', at(2), change)).toBe('missing');
    expect(calls).toEqual([]);
    expect(await store.table.find('v1')).toBeUndefined();

    expect(await store.upsertIfNewer('v1', at(1), () => booked('v1'))).toBe('applied');
    expect(await store.updateIfNewer('v1', at(2), change)).toBe('applied');
    expect(await store.get('v1')).toEqual({ id: 'v1', room: 'B' });
  });

  it('is stale over the trace of a deletion that is not older than the event', async () => {
    const store = new InMemoryReadModelStore(visits);

    await store.upsertIfNewer('v1', at(1), () => booked('v1'));
    await store.delete('v1', at(3));

    expect(await store.updateIfNewer('v1', at(2), moved)).toBe('stale');
    expect(await store.updateIfNewer('v1', at(3), moved)).toBe('stale');
    expect(await store.get('v1')).toBeUndefined();
  });

  it('answers missing for a change later than the deletion of its row, and leaves the trace as it is', async () => {
    const store = new InMemoryReadModelStore(visits);

    await store.delete('v1', at(1));

    expect(await store.updateIfNewer('v1', at(3), moved)).toBe('missing');
    expect(await store.table.find('v1')).toEqual({ key: 'v1', row: undefined, stamp: at(1) });

    await store.upsertIfNewer('v1', at(2), () => booked('v1'));

    expect(await store.updateIfNewer('v1', at(3), moved)).toBe('applied');
  });

  it('loses the older of two changes delivered out of order: it is stale', async () => {
    const store = new InMemoryReadModelStore(visits);

    await store.upsertIfNewer('v1', at(1), () => booked('v1'));

    expect(await store.updateIfNewer('v1', at(3), moved)).toBe('applied');
    expect(await store.updateIfNewer('v1', at(2), (visit) => ({ ...visit, id: 'renamed' }))).toBe('stale');
    expect(await store.get('v1')).toEqual({ id: 'v1', room: 'B' });
  });

  it('keeps upsertIfNewer a filter: a next that answers nothing is ignored, and nothing waits for it', async () => {
    const store = new InMemoryReadModelStore(visits);

    expect(await store.upsertIfNewer('v1', at(2), () => undefined)).toBe('ignored');
    expect(await store.table.find('v1')).toBeUndefined();
  });
});

describe('updateIfNewer during a rebuild', () => {
  const sourceOf = (rows: readonly VisitRow[], between: () => Promise<unknown>): ReadModelSource<VisitRow> => ({
    export: async () => {
      await between();

      return pageOf(rows.map((row) => ({ key: row.id, row, stamp: at(1) })));
    },
    lookup: async (keys) =>
      new Map(rows.filter(({ id }) => keys.includes(id)).map((row) => [row.id, { key: row.id, row, stamp: at(1) }])),
  });

  it('still reads again the key of a change that found no row, and ends on what the source holds', async () => {
    const table = new InMemoryReadModelTable<VisitRow>();
    const store = new TableReadModelStore(table, visits);
    const answers: string[] = [];

    const source = sourceOf([booked('v1')], async () => {
      answers.push(await store.updateIfNewer('v1', at(2), moved));
    });

    const report = await new ProjectionRebuild({ table, source, unitOfWork: new InMemoryUnitOfWork() }).run();

    expect(answers).toEqual(['missing']);
    expect(report).toEqual({ copied: 1, reread: 1, rounds: 0 });
    expect(await store.get('v1')).toEqual(booked('v1'));
    expect(await store.updateIfNewer('v1', at(2), moved)).toBe('applied');
  });

  it('answers missing in the copy a replay fills, and applies the change once the row is there', async () => {
    const table = new InMemoryReadModelTable<VisitRow>();

    await table.beginRebuild();

    const copy = new ShadowReadModelStore(table.shadow());

    expect(await copy.updateIfNewer('v1', at(2), moved)).toBe('missing');

    await copy.upsertIfNewer('v1', at(1), () => booked('v1'));

    expect(await copy.updateIfNewer('v1', at(2), moved)).toBe('applied');
    expect(await copy.get('v1')).toEqual({ id: 'v1', room: 'B' });
  });
});
