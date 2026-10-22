import { describe, expect, expectTypeOf, it } from 'vitest';
import { HydrationTimeoutError, defineCriteria, hydrate, pageOf, type Page } from '../src';

interface AppointmentRow {
  readonly id: string;
  readonly practitionerId: string | null;
  readonly locationId: string;
}

interface Practitioner {
  readonly name: string;
}

/** The fake of a gateway to another context: it answers what it knows and counts how it was asked. */
class Directory<T> {
  readonly calls: string[][] = [];

  constructor(
    private readonly known: Readonly<Record<string, T>>,
    private readonly failure?: Error,
  ) {}

  readonly byIds = async (ids: readonly string[]): Promise<ReadonlyMap<string, T>> => {
    this.calls.push([...ids]);

    if (this.failure !== undefined) {
      throw this.failure;
    }

    return new Map(Object.entries(this.known).filter(([id]) => ids.includes(id)));
  };
}

const rows: AppointmentRow[] = [
  { id: 'a1', practitionerId: 'p1', locationId: 'l1' },
  { id: 'a2', practitionerId: 'p2', locationId: 'l1' },
  { id: 'a3', practitionerId: 'p1', locationId: 'l2' },
  { id: 'a4', practitionerId: null, locationId: 'l1' },
  { id: 'a5', practitionerId: 'p9', locationId: 'l1' },
];

const unknownPractitioner: Practitioner = { name: 'unknown' };
const practitioners = (): Directory<Practitioner> => new Directory({ p1: { name: 'Ada' }, p2: { name: 'Bob' } });
const locations = (): Directory<{ city: string }> => new Directory({ l1: { city: 'Lyon' }, l2: { city: 'Nice' } });

describe('hydrate', () => {
  it('asks each relation once for the page, with every key once, never per row', async () => {
    const [directory, places] = [practitioners(), locations()];

    const page = await hydrate(rows)
      .with('practitioner', (row) => row.practitionerId, directory.byIds)
      .with('location', (row) => row.locationId, places.byIds);

    expect(directory.calls).toEqual([['p1', 'p2', 'p9']]);
    expect(places.calls).toEqual([['l1', 'l2']]);
    expect(page.items[0]).toEqual({ ...rows[0], practitioner: { name: 'Ada' }, location: { city: 'Lyon' } });
    expect(page.items[2]).toEqual({ ...rows[2], practitioner: { name: 'Ada' }, location: { city: 'Nice' } });
    expect(page.warnings).toEqual([]);
  });

  it('leaves a row without the property when its key is null or unknown on the other side', async () => {
    const page = await hydrate(rows).with('practitioner', (row) => row.practitionerId, practitioners().byIds);

    expect(page.items.map((row) => row.practitioner?.name)).toEqual(['Ada', 'Bob', 'Ada', undefined, undefined]);
    expect('practitioner' in (page.items[3] ?? {})).toBe(false);
    expectTypeOf(page.items.map((row) => row.practitioner)).toEqualTypeOf<(Practitioner | undefined)[]>();
    expectTypeOf(page.items.map((row) => row.locationId)).toEqualTypeOf<string[]>();
  });

  it('gives every row the fallback of a relation that has one', async () => {
    const page = await hydrate(rows)
      .with('practitioner', (row) => row.practitionerId, practitioners().byIds)
      .orElse('practitioner', unknownPractitioner);

    expect(page.items.map((row) => row.practitioner.name)).toEqual(['Ada', 'Bob', 'Ada', 'unknown', 'unknown']);
    expectTypeOf(page.items.map((row) => row.practitioner)).toEqualTypeOf<Practitioner[]>();
  });

  it('keeps a page a page, with the same paging', async () => {
    const source: Page<AppointmentRow> = pageOf(rows.slice(0, 2), { total: 5, nextCursor: 'next' });
    const page = await hydrate(source).with('practitioner', (row) => row.practitionerId, practitioners().byIds);

    expect(page).toMatchObject({ total: 5, nextCursor: 'next', warnings: [] });
    expect(page.items).toHaveLength(2);
  });

  it('calls nothing for an empty page or for rows without a key', async () => {
    const directory = practitioners();

    await hydrate<AppointmentRow>([]).with('practitioner', (row) => row.practitionerId, directory.byIds);

    await hydrate([rows[3] ?? rows[0]].flatMap((row) => row ?? [])).with(
      'practitioner',
      (row) => row.practitionerId,
      directory.byIds,
    );

    expect(directory.calls).toEqual([]);
  });

  it('loads its relations at the same time', async () => {
    const started: string[] = [];
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const waiting = (name: string) => async (): Promise<ReadonlyMap<string, string>> => {
      started.push(name);
      await gate;

      return new Map();
    };

    const loading = hydrate(rows)
      .with('practitioner', (row) => row.practitionerId, waiting('practitioners'))
      .with('location', (row) => row.locationId, waiting('locations'))
      .then((page) => page);

    await Promise.resolve();
    expect(started).toEqual(['practitioners', 'locations']);

    release();
    await loading;
  });
});

describe('hydrate, when the other context fails', () => {
  const down = (): Directory<Practitioner> => new Directory({}, new Error('the directory is down'));

  it('fails the whole read by default', async () => {
    const hydration = hydrate(rows).with('practitioner', (row) => row.practitionerId, down().byIds);

    await expect(hydration).rejects.toThrow('the directory is down');
  });

  it('fails as well with a fallback that is only for missing rows', async () => {
    const hydration = hydrate(rows)
      .with('practitioner', (row) => row.practitionerId, down().byIds)
      .orElse('practitioner', unknownPractitioner);

    await expect(hydration).rejects.toThrow('the directory is down');
  });

  it('answers the fallback and a warning when the relation says so, the other relations untouched', async () => {
    const page = await hydrate(rows)
      .with('practitioner', (row) => row.practitionerId, down().byIds)
      .with('location', (row) => row.locationId, locations().byIds)
      .orElse('practitioner', unknownPractitioner, { onFailure: 'fallback' });

    expect(page.items.map((row) => row.practitioner.name)).toEqual([
      'unknown',
      'unknown',
      'unknown',
      'unknown',
      'unknown',
    ]);

    expect(page.items[0]?.location).toEqual({ city: 'Lyon' });
    expect(page.warnings).toEqual([{ relation: 'practitioner', code: 'lookup_failed' }]);
    expect(JSON.stringify(page.warnings)).not.toContain('down');
  });

  it('gives a lookup up after its time, by the same policy', async () => {
    const never = (): Promise<ReadonlyMap<string, Practitioner>> => new Promise(() => undefined);
    const slow = hydrate(rows).with('practitioner', (row) => row.practitionerId, never);

    const page = await slow.orElse('practitioner', unknownPractitioner, { onFailure: 'fallback', timeoutMs: 5 });

    expect(page.warnings).toEqual([{ relation: 'practitioner', code: 'lookup_timed_out' }]);

    await expect(slow.orElse('practitioner', unknownPractitioner, { timeoutMs: 5 })).rejects.toThrow(
      HydrationTimeoutError,
    );
  });
});

describe('a hydrated field and criteria', () => {
  it('cannot be named by a criteria definition: the read model does not hold it', () => {
    type Hydrated = AppointmentRow & { readonly practitioner?: Practitioner };

    const definition = defineCriteria<Hydrated>({
      fields: {
        id: { type: 'string' },
        // @ts-expect-error -- hydrated at query time: project it to filter or sort by it
        practitioner: { type: 'string', filter: ['eq'], sortable: true },
      },
      // @ts-expect-error -- nor can it break ties
      tieBreaker: 'practitioner',
    });

    expect(definition.tieBreaker).toBe('practitioner');
  });
});
