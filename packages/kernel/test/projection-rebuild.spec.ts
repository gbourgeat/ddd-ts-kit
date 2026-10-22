import { describe, expect, it } from 'vitest';
import {
  Criteria,
  InMemoryReadModelStore,
  InMemoryReadModelTable,
  InMemoryUnitOfWork,
  ProjectionRebuild,
  ShadowReadModelStore,
  defineCriteria,
  pageOf,
  scoped,
  type EventStamp,
  type Page,
  type ProjectionRebuildParts,
  type ProjectionRebuildReport,
  type ReadModelSource,
  type StampedRow,
} from '../src';

interface RoomRow {
  readonly id: string;
  readonly name: string;
}

const rooms = defineCriteria<RoomRow>({
  fields: { id: { type: 'string', sortable: true }, name: { type: 'string', sortable: true } },
  tieBreaker: 'id',
});

const at = (minute: number): EventStamp => ({
  eventId: `evt-${String(minute)}`,
  occurredAt: new Date(Date.UTC(2026, 9, 18, 9, minute)),
});

const room = (id: string, name = `Room ${id}`): RoomRow => ({ id, name });

/**
 * The context a read model is rebuilt from: rows by key, exported two at a time. `duringExport`
 * runs between two pages and `duringLookup` before each lookup: where a test makes an event arrive.
 */
class RoomDirectory implements ReadModelSource<RoomRow> {
  readonly lookups: string[][] = [];

  duringExport: () => Promise<void> = () => Promise.resolve();

  duringLookup: (lookup: number) => Promise<void> = () => Promise.resolve();

  private readonly rows = new Map<string, StampedRow<RoomRow>>();

  constructor(ids: readonly string[] = [], minute = 2) {
    for (const id of ids) {
      this.put(room(id), minute);
    }
  }

  put(row: RoomRow, minute: number): void {
    this.rows.set(row.id, { key: row.id, row, stamp: at(minute) });
  }

  remove(id: string): void {
    this.rows.delete(id);
  }

  async export(cursor: string | undefined): Promise<Page<StampedRow<RoomRow>>> {
    if (cursor !== undefined) {
      await this.duringExport();
    }

    const after = [...this.rows.keys()].sort().filter((key) => cursor === undefined || key > cursor);
    const keys = after.slice(0, 2);
    const last = keys.at(-1);

    return pageOf(
      keys.flatMap((key) => this.rows.get(key) ?? []),
      after.length > 2 && last !== undefined ? { nextCursor: last } : {},
    );
  }

  async lookup(keys: readonly string[]): Promise<ReadonlyMap<string, StampedRow<RoomRow>>> {
    await this.duringLookup(this.lookups.length);
    this.lookups.push([...keys]);

    return new Map(
      keys.flatMap((key) => {
        const entry = this.rows.get(key);

        return entry === undefined ? [] : [[key, entry] as const];
      }),
    );
  }
}

/** A read model in memory, the unit of work of its rebuild, and what a test reads of it. */
function aRoomList() {
  const store = new InMemoryReadModelStore(rooms);
  const unitOfWork = new InMemoryUnitOfWork();

  const rebuild = (
    source: ReadModelSource<RoomRow>,
    options: Partial<ProjectionRebuildParts<RoomRow>> = {},
  ): Promise<ProjectionRebuildReport> =>
    new ProjectionRebuild({ table: store.table, source, unitOfWork, ...options }).run();

  const put = (written: RoomRow, minute: number) => store.upsertIfNewer(written.id, at(minute), () => written);

  const ids = async () =>
    (await store.search(scoped(Criteria.of<RoomRow>().orderBy('id'), { kind: 'all' }))).items.map(({ id }) => id);

  return { store, rebuild, put, ids };
}

describe('ProjectionRebuild', () => {
  it('rebuilds from the source alone: a wrong row is corrected, a row the source does not hold is gone', async () => {
    const { store, rebuild, put, ids } = aRoomList();

    await put(room('r1', 'wrong'), 1);
    await put(room('r2'), 1);

    const report = await rebuild(new RoomDirectory(['r1', 'r3', 'r4', 'r5']));

    expect(report).toEqual({ copied: 4, reread: 0, rounds: 0 });
    expect(await ids()).toEqual(['r1', 'r3', 'r4', 'r5']);
    expect(await store.get('r1')).toEqual(room('r1'));
    expect(await store.table.rebuilding()).toBe(false);
  });

  it('reads again from the source a row an event wrote while it exported', async () => {
    const { store, rebuild } = aRoomList();
    const source = new RoomDirectory(['r1', 'r3', 'r4']);

    source.duringExport = async () => {
      source.put(room('r1', 'renamed meanwhile'), 9);
      await store.upsertIfNewer('r1', at(9), () => room('r1', 'renamed meanwhile'));
    };

    const report = await rebuild(source);

    expect(report).toEqual({ copied: 3, reread: 1, rounds: 0 });
    expect(source.lookups).toEqual([['r1']]);
    expect(await store.get('r1')).toEqual(room('r1', 'renamed meanwhile'));
  });

  it('reads the touched keys again in rounds, by batches, before it holds the writers', async () => {
    const { store, rebuild } = aRoomList();
    const source = new RoomDirectory(['r1', 'r3', 'r4']);

    source.duringExport = async () => {
      for (const id of ['r1', 'r3']) {
        source.put(room(id, 'renamed meanwhile'), 9);
        await store.upsertIfNewer(id, at(9), () => room(id, 'renamed meanwhile'));
      }
    };

    const report = await rebuild(source, { settledBelow: 0, batchSize: 1 });

    expect(report).toEqual({ copied: 3, reread: 2, rounds: 2 });
    expect(source.lookups).toEqual([['r1'], ['r3']]);
    expect(await store.get('r3')).toEqual(room('r3', 'renamed meanwhile'));
  });

  it('starts the swap after its last round while events keep coming, and reads what remains with the writers held', async () => {
    const { store, rebuild } = aRoomList();
    const source = new RoomDirectory(['r1', 'r3', 'r4']);

    source.duringExport = async () => {
      await store.upsertIfNewer('r1', at(5), () => room('r1', 'renamed 5'));
    };

    source.duringLookup = async (lookup) => {
      if (lookup < 3) {
        const minute = 6 + lookup;

        source.put(room('r1', `renamed ${String(minute)}`), minute);
        await store.upsertIfNewer('r1', at(minute), () => room('r1', `renamed ${String(minute)}`));
      }
    };

    const report = await rebuild(source, { settledBelow: 0, maxRounds: 2 });

    expect(report).toEqual({ copied: 3, reread: 4, rounds: 2 });
    expect(source.lookups).toHaveLength(4);
    expect(await store.get('r1')).toEqual(room('r1', 'renamed 8'));
  });

  it('drops a row deleted while it exports, and keeps the trace of the deletion', async () => {
    const { store, rebuild, put, ids } = aRoomList();
    const source = new RoomDirectory(['r1', 'r3', 'r4']);

    await put(room('r1'), 1);

    source.duringExport = async () => {
      source.remove('r1');
      await store.delete('r1', at(9));
    };

    await rebuild(source);

    expect(await ids()).toEqual(['r3', 'r4']);
    expect(await put(room('r1'), 5)).toBe('stale');
    expect(await put(room('r1'), 10)).toBe('applied');
  });

  it('forgets a touched key the source no longer has and the table never held', async () => {
    const { store, rebuild, ids } = aRoomList();
    const source = new RoomDirectory(['r1', 'r3', 'r4']);

    source.duringExport = async () => {
      expect(await store.upsertIfNewer('r9', at(9), (current) => current)).toBe('ignored');
    };

    const report = await rebuild(source);

    expect(report.reread).toBe(1);
    expect(source.lookups).toEqual([['r9']]);
    expect(await ids()).toEqual(['r1', 'r3', 'r4']);
    expect(await store.table.find('r9')).toBeUndefined();
  });

  it('keeps the trace of a row deleted before it started', async () => {
    const { store, rebuild, put, ids } = aRoomList();

    await put(room('r2'), 1);
    await store.delete('r2', at(4));
    await rebuild(new RoomDirectory(['r1']));

    expect(await put(room('r2'), 3)).toBe('stale');
    expect(await ids()).toEqual(['r1']);
  });

  it('leaves the table as it was when the export fails, and the next write goes through as usual', async () => {
    const { store, rebuild, put, ids } = aRoomList();
    const source = new RoomDirectory(['r1', 'r3', 'r4']);

    await put(room('r2'), 1);
    source.duringExport = () => Promise.reject(new Error('the directory is down'));

    await expect(rebuild(source)).rejects.toThrow('the directory is down');

    expect(await ids()).toEqual(['r2']);
    expect(await store.table.rebuilding()).toBe(false);
    expect(await store.table.touched(10)).toEqual([]);
    expect(await put(room('r5'), 2)).toBe('applied');
  });
});

describe('InMemoryReadModelTable', () => {
  const entry = (id: string, minute: number): StampedRow<RoomRow> => ({ key: id, row: room(id), stamp: at(minute) });

  it('inserts a key once, and replaces a row only from the stamp it holds', async () => {
    const table = new InMemoryReadModelTable<RoomRow>();

    expect(await table.insert(entry('r1', 1))).toBe(true);
    expect(await table.insert(entry('r1', 2))).toBe(false);
    expect(await table.replace(entry('r1', 3), at(2))).toBe(false);
    expect(await table.replace(entry('r2', 3), at(2))).toBe(false);
    expect(await table.replace({ key: 'r1', row: undefined, stamp: at(3) }, at(1))).toBe(true);
    expect(await table.find('r1')).toEqual({ key: 'r1', row: undefined, stamp: at(3) });
  });

  it('counts the touches of a key, and settles it only when it was not touched again since it was read', async () => {
    const table = new InMemoryReadModelTable<RoomRow>();

    await table.beginRebuild();
    await table.touch('r2');
    await table.touch('r1');
    await table.touch('r2');

    const read = await table.touched(10);

    await table.touch('r2');
    await table.settle(read);

    expect(read).toEqual([
      { key: 'r1', mark: 1 },
      { key: 'r2', mark: 2 },
    ]);

    expect(await table.touched(10)).toEqual([{ key: 'r2', mark: 3 }]);
  });

  it('has no copy outside a rebuild: what is written there is kept nowhere, and promoting keeps the table', async () => {
    const table = new InMemoryReadModelTable<RoomRow>();

    await table.insert(entry('r1', 1));

    expect(await table.shadow().insert(entry('r2', 1))).toBe(true);
    expect(await table.shadow().find('r2')).toBeUndefined();

    await table.holdWriters();
    await table.promote();

    expect(await table.find('r1')).toEqual(entry('r1', 1));
    expect(await table.find('r2')).toBeUndefined();
  });
});

describe('TableReadModelStore', () => {
  it('answers an empty page for a scope that sees nothing', async () => {
    const { store, put } = aRoomList();

    await put(room('r1'), 1);

    const page = await store.search(scoped(Criteria.of<RoomRow>(), { kind: 'none' }));

    expect(page.items).toEqual([]);
  });

  it('lists the rows of a plan, the deleted ones left out', async () => {
    const { store, put } = aRoomList();

    await put(room('r1', 'Lavender'), 1);
    await put(room('r2', 'Basil'), 1);
    await put(room('r3', 'Cedar'), 1);
    await store.delete('r3', at(2));

    const page = await store.search(scoped(Criteria.of<RoomRow>().orderBy('name'), { kind: 'all' }));

    expect(page.items.map(({ name }) => name)).toEqual(['Basil', 'Lavender']);
  });
});

describe('ShadowReadModelStore', () => {
  it('writes the copy of a rebuild as the live store would, and refuses to be searched', async () => {
    const table = new InMemoryReadModelTable<RoomRow>();

    await table.beginRebuild();

    const copy = new ShadowReadModelStore(table.shadow());

    expect(await copy.upsertIfNewer('r1', at(2), () => room('r1'))).toBe('applied');
    expect(await copy.upsertIfNewer('r1', at(1), () => room('r1', 'older'))).toBe('stale');
    expect(await copy.get('r1')).toEqual(room('r1'));
    expect(await copy.delete('r1', at(3))).toBe('applied');
    expect(await copy.get('r1')).toBeUndefined();
    expect(await table.find('r1')).toBeUndefined();

    await expect(copy.search(scoped(Criteria.of<RoomRow>(), { kind: 'all' }))).rejects.toThrow(
      'The copy of a read model being rebuilt is written, never searched',
    );
  });
});
