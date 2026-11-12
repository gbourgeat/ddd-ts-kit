import { describe, expect, it } from 'vitest';
import {
  InMemoryReadModelStore,
  InMemoryReadModelTable,
  MixedStampsError,
  defineCriteria,
  isNewer,
  sameStamp,
  type EventStamp,
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

async function failureOf(act: () => Promise<unknown>): Promise<unknown> {
  return act().then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('the order of stamps', () => {
  const byInstant = [at(1), at(2), at(5), { ...at(5), eventId: 'evt-5b' }, at(9)];
  const byVersion = [at(9, 1), at(5, 2), at(1, 3), at(7, 4)];

  it.each([
    ['without a version', byInstant],
    ['with a version', byVersion],
  ])('is total and transitive over stamps %s', (_kind, stamps) => {
    for (const a of stamps) {
      expect(isNewer(a, a)).toBe(false);

      for (const b of stamps.filter((other) => other !== a)) {
        expect(isNewer(a, b)).toBe(!isNewer(b, a));

        for (const c of stamps.filter((other) => isNewer(b, other))) {
          expect(isNewer(a, c) || !isNewer(a, b)).toBe(true);
        }
      }
    }
  });

  it('refuses to compare a stamp with a version and one without, where the instants used to make a cycle', () => {
    const [a, b, c] = [at(9, 1), at(5), at(1, 2)];

    expect(isNewer(c, a)).toBe(true);
    expect(() => isNewer(a, b)).toThrow(MixedStampsError);
    expect(() => isNewer(b, c)).toThrow(MixedStampsError);
    expect(() => isNewer(b, a, 'v1')).toThrow('The read model, under the key "v1", holds a stamp with a version');
    expect(() => isNewer(a, b)).toThrow('A read model holds a stamp without a version (event "evt-5")');
  });

  it.each([
    ['without a version', [at(1), at(2), at(3)]],
    ['with a version', [at(3, 1), at(2, 2), at(1, 3)]],
  ])('ends on the same row whatever the order of three events %s', async (_kind, stamps) => {
    const latest = stamps[2]?.eventId;

    for (const order of permutationsOf(stamps)) {
      const store = new InMemoryReadModelStore(visits);

      for (const stamp of order) {
        await store.upsertIfNewer('v1', stamp, () => ({ id: 'v1', room: stamp.eventId }));
      }

      expect(await store.get('v1')).toEqual({ id: 'v1', room: latest });
    }
  });

  it('refuses, by the name of the key, a write whose stamp is not of the kind the key holds', async () => {
    const store = new InMemoryReadModelStore(visits);

    await store.upsertIfNewer('v1', at(1, 1), () => booked('v1'));
    await store.delete('v2', at(1));

    const refusal = await failureOf(() => store.upsertIfNewer('v1', at(2), () => booked('v1')));

    expect(refusal).toBeInstanceOf(MixedStampsError);
    expect(refusal).toMatchObject({ key: 'v1', incoming: at(2), held: at(1, 1), name: 'MixedStampsError' });
    await expect(store.updateIfNewer('v1', at(2), moved)).rejects.toThrow(MixedStampsError);
    await expect(store.delete('v1', at(2))).rejects.toThrow(MixedStampsError);
    await expect(store.upsertIfNewer('v2', at(2, 2), () => booked('v2'))).rejects.toThrow(MixedStampsError);
    expect(await store.get('v1')).toEqual(booked('v1'));
  });
});

describe('sameStamp', () => {
  it('compares the event id, the instant and the version', () => {
    expect(sameStamp(at(1, 2), at(1, 2))).toBe(true);
    expect(sameStamp(at(1), at(1))).toBe(true);
    expect(sameStamp(at(1, 2), at(1, 3))).toBe(false);
    expect(sameStamp(at(1, 2), at(1))).toBe(false);
    expect(sameStamp(at(1), at(2))).toBe(false);
    expect(sameStamp(at(1), { ...at(1), eventId: 'other' })).toBe(false);
  });

  it('refuses in memory a replace conditional on a stamp whose version alone differs', async () => {
    const table = new InMemoryReadModelTable<VisitRow>();

    await table.insert({ key: 'v1', row: booked('v1'), stamp: at(1, 2) });

    expect(await table.replace({ key: 'v1', row: moved(booked('v1')), stamp: at(2, 4) }, at(1, 3))).toBe(false);
    expect(await table.replace({ key: 'v1', row: moved(booked('v1')), stamp: at(2, 4) }, at(1, 2))).toBe(true);
  });
});

function permutationsOf<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [[...items]];
  }

  return items.flatMap((item, index) =>
    permutationsOf([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}
