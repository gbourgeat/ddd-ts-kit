import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  EventStorePersonalDataExport,
  InMemoryEventStore,
  InMemorySubjectKeyStore,
  PersonalDataCipher,
  executionContext,
  exportDataSubject,
  personalData,
  recordsInEachTenant,
  storedDataOf,
  systemActor,
  type EventStore,
} from '../src';

const AT = new Date('2026-03-01T10:00:00.000Z');
const clock = { now: () => AT };

async function append(
  store: EventStore,
  keys: InMemorySubjectKeyStore,
  stream: string,
  type: string,
  data: Readonly<Record<string, unknown>>,
) {
  const sealed = await new PersonalDataCipher(keys).seal(storedDataOf(data));

  const metadata = stream === 'care.dossier-d1' ? { metadata: { aggregateId: 'd1' } } : {};

  await store.append(stream, (await store.readStream(stream)).length, [
    { id: `${stream}-${type}`, type, schemaVersion: 1, data: sealed, occurredAt: AT, ...metadata },
  ]);
}

/** The event of a record: its stream, its aggregate, its version, its instant. */
function eventOf(stream: string, aggregateId: string, version: number) {
  return { stream, aggregateId, version, occurredAt: AT };
}

async function seeded(store: EventStore = new InMemoryEventStore()) {
  const keys = new InMemorySubjectKeyStore();

  await append(store, keys, 'care.dossier-d1', 'care.dossier.opened', {
    patientId: 'ada',
    note: personalData('ada', 'Asthma'),
  });

  await append(store, keys, 'care.dossier-d1', 'care.dossier.contacts-noted', {
    contacts: [personalData('ada', 'ada@example.org'), personalData('bob', 'bob@example.org')],
    next: { of: personalData('ada', 'Grace') },
  });

  await append(store, keys, 'care.dossier-d2', 'care.dossier.opened', {
    patientId: 'bob',
    note: personalData('bob', 'Flu'),
  });

  await append(store, keys, 'care.dossier-d2', 'care.dossier.closed', { patientId: 'bob' });

  return { store, keys };
}

describe('EventStorePersonalDataExport', () => {
  it('answers one record per event that holds a value of the subject, each value opened under its path', async () => {
    const { store, keys } = await seeded();
    const exporter = new EventStorePersonalDataExport({ events: store, keys, batchSize: 1 });

    expect(await exporter.exportOf('ada')).toEqual([
      {
        source: 'event-store.care.dossier.opened',
        values: { note: 'Asthma' },
        event: eventOf('care.dossier-d1', 'd1', 1),
      },
      {
        source: 'event-store.care.dossier.contacts-noted',
        values: { 'contacts[0]': 'ada@example.org', 'next.of': 'Grace' },
        event: eventOf('care.dossier-d1', 'd1', 2),
      },
    ]);

    expect(await exporter.exportOf('bob')).toEqual([
      {
        source: 'event-store.care.dossier.contacts-noted',
        values: { 'contacts[1]': 'bob@example.org' },
        event: eventOf('care.dossier-d1', 'd1', 2),
      },
      {
        source: 'event-store.care.dossier.opened',
        values: { note: 'Flu' },
        event: eventOf('care.dossier-d2', 'care.dossier-d2', 1),
      },
    ]);

    expect(await exporter.exportOf('nobody')).toEqual([]);
  });

  it('names a value that does not decipher in its record, and goes on with the others', async () => {
    const keys = new InMemorySubjectKeyStore();
    const store = new InMemoryEventStore();

    const sealed = await new PersonalDataCipher(keys).seal(
      storedDataOf({ note: personalData('ada', 'Asthma'), name: personalData('ada', 'Ada') }),
    );

    const note = sealed['note'];
    const altered = typeof note === 'object' && note !== null && '$sealed' in note ? note['$sealed'] : {};

    await store.append('care.dossier-d3', 0, [
      {
        id: 'e-1',
        type: 'care.dossier.opened',
        schemaVersion: 1,
        data: { ...sealed, note: { $sealed: { ...Object(altered), data: 'AAAAAAAAAAAAAAAAAAAAAAAA' } } },
        occurredAt: AT,
      },
    ]);

    expect(await new EventStorePersonalDataExport({ events: store, keys }).exportOf('ada')).toEqual([
      {
        source: 'event-store.care.dossier.opened',
        values: { name: 'Ada' },
        event: eventOf('care.dossier-d3', 'care.dossier-d3', 1),
        unreadable: ['note'],
      },
    ]);
  });

  it('answers nothing of a subject once erased, the values of the others staying', async () => {
    const { store, keys } = await seeded();
    const exporter = new EventStorePersonalDataExport({ events: store, keys, name: 'platform.event-store' });

    await keys.erase('ada');

    expect(await exporter.exportOf('ada')).toEqual([]);

    expect((await exporter.exportOf('bob')).map(({ source }) => source)).toEqual([
      'platform.event-store.care.dossier.contacts-noted',
      'platform.event-store.care.dossier.opened',
    ]);
  });

  it('reads the events of the tenant of the work, so an export run in every tenant hands each value over once', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const store = new InMemoryEventStore(scope);
    const keys = new InMemorySubjectKeyStore();

    const inTenant = (tenantId: string) =>
      executionContext({ correlationId: 'seed', actor: systemActor('test'), origin: 'cli', tenantId });

    await scope.run(inTenant('acme'), () =>
      append(store, keys, 'care.dossier-d1', 'care.dossier.opened', { note: personalData('ada', 'Asthma') }),
    );

    await scope.run(inTenant('north'), () =>
      append(store, keys, 'care.dossier-d9', 'care.dossier.opened', { note: personalData('ada', 'Flu') }),
    );

    const operator = executionContext({ correlationId: 'export-1', actor: systemActor('export'), origin: 'cli' });

    const document = await scope.run(operator, () =>
      exportDataSubject('ada', {
        exports: [new EventStorePersonalDataExport({ events: store, keys, scope })],
        inEveryTenant: recordsInEachTenant(scope, ['acme', 'north']),
        clock,
      }),
    );

    expect(document.records.map(({ values }) => values)).toEqual([{ note: 'Asthma' }, { note: 'Flu' }]);
  });
});
