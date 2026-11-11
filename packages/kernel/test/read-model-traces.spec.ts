import { describe, expect, it } from 'vitest';
import {
  InMemoryReadModelStore,
  InMemoryReadModelTable,
  InMemoryUnitOfWork,
  ProjectionRebuild,
  ReadModelTableNotReadyError,
  defineCriteria,
  pageOf,
  type EventStamp,
  type ReadModelSource,
  type StampedRow,
} from '../src';

interface RoomRow {
  readonly id: string;
  readonly name: string;
}

const rooms = defineCriteria<RoomRow>({
  fields: { id: { type: 'string', sortable: true }, name: { type: 'string' } },
  tieBreaker: 'id',
});

const at = (minute: number): EventStamp => ({
  eventId: `evt-${String(minute)}`,
  occurredAt: new Date(Date.UTC(2026, 10, 11, 9, minute)),
});

const room = (id: string): RoomRow => ({ id, name: `Room ${id}` });

/** A source of two pages, one row each, that lets a test act before the second page is read. */
function aDirectory(first: string, second: string) {
  const rows = new Map<string, StampedRow<RoomRow>>(
    [first, second].map((id) => [id, { key: id, row: room(id), stamp: at(1) }]),
  );

  const directory = {
    betweenPages: (): Promise<unknown> => Promise.resolve(),
    remove: (id: string) => rows.delete(id),
  };

  const source: ReadModelSource<RoomRow> = {
    export: async (cursor) => {
      if (cursor !== undefined) {
        await directory.betweenPages();
      }

      const held = rows.get(cursor === undefined ? first : second);

      return pageOf(held === undefined ? [] : [held], cursor === undefined ? { nextCursor: first } : {});
    },
    lookup: async (keys) => new Map(keys.flatMap((key) => [...rows].filter(([id]) => id === key))),
  };

  return { directory, source };
}

describe('the trace of a deletion', () => {
  it('is kept under a key the read model does not hold: the creation it follows is stale, a later one applies', async () => {
    const store = new InMemoryReadModelStore(rooms);

    expect(await store.delete('r1', at(3))).toBe('applied');
    expect(await store.table.find('r1')).toEqual({ key: 'r1', row: undefined, stamp: at(3) });
    expect(await store.upsertIfNewer('r1', at(2), () => room('r1'))).toBe('stale');
    expect(await store.get('r1')).toBeUndefined();
    expect(await store.upsertIfNewer('r1', at(4), () => room('r1'))).toBe('applied');
    expect(await store.get('r1')).toEqual(room('r1'));
  });

  it('is inserted once: a second one under the same key is refused', async () => {
    const table = new InMemoryReadModelTable<RoomRow>();

    expect(await table.insert({ key: 'r1', row: undefined, stamp: at(1) })).toBe(true);
    expect(await table.insert({ key: 'r1', row: undefined, stamp: at(2) })).toBe(false);
  });

  it('reaches the copy of a rebuild for a row deleted before its page was copied', async () => {
    const store = new InMemoryReadModelStore(rooms);
    const { directory, source } = aDirectory('r1', 'r2');

    await store.upsertIfNewer('r2', at(1), () => room('r2'));

    directory.betweenPages = () => {
      directory.remove('r2');

      return store.delete('r2', at(9));
    };

    await new ProjectionRebuild({ table: store.table, source, unitOfWork: new InMemoryUnitOfWork() }).run();

    expect(await store.table.find('r2')).toEqual({ key: 'r2', row: undefined, stamp: at(9) });
    expect(await store.upsertIfNewer('r2', at(5), () => room('r2'))).toBe('stale');
  });
});

describe('ReadModelTableNotReadyError', () => {
  it('names the column that refuses NULL and the check constraint of the live rows', () => {
    const error = new ReadModelTableNotReadyError('scheduling.agenda', ['starts_at']);

    expect(error.name).toBe('ReadModelTableNotReadyError');
    expect(error.columns).toEqual(['starts_at']);

    expect(error.message).toBe(
      'The read model table scheduling.agenda cannot hold the trace of a deleted row: "starts_at" refuses NULL, and a deleted row keeps its key and its stamp only. Write a migration that drops NOT NULL there (alter table scheduling.agenda alter column <column> drop not null) and keeps the live rows whole with a check constraint: check (deleted or ("starts_at" is not null))',
    );
  });

  it('names every column when several refuse NULL', () => {
    const { message } = new ReadModelTableNotReadyError('agenda', ['starts_at', 'status']);

    expect(message).toContain('"starts_at", "status" refuse NULL');
    expect(message).toContain('check (deleted or ("starts_at" is not null and "status" is not null))');
  });
});
