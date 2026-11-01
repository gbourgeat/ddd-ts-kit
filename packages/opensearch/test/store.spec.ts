import {
  ConcurrencyError,
  Criteria,
  InMemoryUnitOfWork,
  ProjectionRebuild,
  defineCriteria,
  scoped,
  type EventStamp,
} from '@ddd-ts-kit/kernel';
import { SourceOfTruth, criteriaContractRows, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { describe, expect, it } from 'vitest';
import {
  InvalidIndexNameError,
  OpenSearchReadModelStore,
  OpenSearchRequestError,
  UnprovisionedIndexError,
  UnsupportedRebuildError,
  type OpenSearchRequest,
  type OpenSearchTransport,
} from '../src';
import { decimalKey } from '../src/mapping/decimal-key';
import { readModelOf, scope, type ReadModelUnderTest } from './support/read-models';
import { onEachNode, type NodeUnderTest } from './support/on-each-node';
import { aReadModelName } from './support/servers';

const stamp: EventStamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };
const later: EventStamp = { eventId: 'evt-2', occurredAt: new Date('2026-10-10T12:01:00.000Z') };
const [row = criteriaContractRows()[0] as CriteriaContractRow] = criteriaContractRows();

interface Ledger {
  readonly id: string;
  readonly amount: string;
  readonly note: string | null;
  readonly closedAt: Date | null;
}

const ledger = defineCriteria<Ledger>({
  fields: { id: { type: 'string', filter: ['eq'] }, amount: { type: 'decimal', filter: ['eq', 'gt'], sortable: true } },
  tieBreaker: 'id',
});

/** A transport that keeps what it sends, and may turn the answer of a document write into a conflict. */
function recorded(
  transport: OpenSearchTransport,
  conflicts = false,
): OpenSearchTransport & { sent: OpenSearchRequest[] } {
  const sent: OpenSearchRequest[] = [];

  return {
    sent,
    async request(request) {
      sent.push(request);

      if (conflicts && request.method === 'PUT' && request.path.includes('/_doc/')) {
        return {
          status: 409,
          body: { error: { type: 'version_conflict_engine_exception', reason: 'conflict' }, status: 409 },
        };
      }

      return transport.request(request);
    },
  };
}

async function mapped(
  { node, created }: NodeUnderTest,
  options: Parameters<typeof readModelOf>[2] = {},
): Promise<ReadModelUnderTest> {
  const model = readModelOf(node, 'none', options);

  created.push(...model.indices);
  await model.store.ensureMapping();

  return model;
}

function ledgerOf(
  { node, created }: NodeUnderTest,
  name = aReadModelName(),
  transport = node.transport,
): OpenSearchReadModelStore<Ledger> {
  created.push(`${name}.v1`);

  return new OpenSearchReadModelStore<Ledger>({
    transport,
    name,
    definition: ledger,
    fields: { note: 'string', closedAt: 'instant' },
    refresh: 'wait_for',
    settings: node.settings,
  });
}

onEachNode('OpenSearchReadModelStore, mapping and fields', (current) => {
  it('maps again without harm, and refuses a write before the read model is mapped', async () => {
    const model = await mapped(current());
    const unmapped = readModelOf(current().node, 'none');

    await model.store.upsertIfNewer(row.id, stamp, () => row);
    await model.store.ensureMapping();

    expect(await model.store.get(row.id)).toEqual(row);
    await expect(unmapped.store.upsertIfNewer(row.id, stamp, () => row)).rejects.toThrow(UnprovisionedIndexError);

    await expect(unmapped.store.search(scoped(Criteria.of(), { kind: 'all' }))).rejects.toThrow(
      UnprovisionedIndexError,
    );
  });

  it('refuses a field the read model does not declare, at the write', async () => {
    const model = await mapped(current());

    const refusal = await model.store
      .upsertIfNewer(row.id, stamp, () => ({ ...row, colour: 'red' }))
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(OpenSearchRequestError);
    expect((refusal as OpenSearchRequestError).type).toBe('strict_dynamic_mapping_exception');
    expect(await model.store.get(row.id)).toBeUndefined();
  });

  it('keeps the other fields of a row with their type, and a decimal as it was written, ordered as a number', async () => {
    const store = ledgerOf(current());
    const closedAt = new Date('2026-10-11T08:30:00.250Z');

    await store.ensureMapping();

    for (const [id, amount] of [
      ['l1', '12345678901234567890.2'],
      ['l2', '12345678901234567890.10'],
      ['l3', '-0.5'],
      ['l4', '0'],
    ]) {
      await store.upsertIfNewer(String(id), stamp, () => ({
        id: String(id),
        amount: String(amount),
        note: null,
        closedAt,
      }));
    }

    const above = await store.search(
      scoped(Criteria.of<Ledger>().where('amount', 'gt', '-0.50').orderBy('amount'), { kind: 'all' }),
    );

    const equal = await store.search(
      scoped(Criteria.of<Ledger>().where('amount', 'eq', '12345678901234567890.1'), { kind: 'all' }),
    );

    expect(await store.get('l2')).toEqual({ id: 'l2', amount: '12345678901234567890.10', note: null, closedAt });
    expect(above.items.map(({ id }) => id)).toEqual(['l4', 'l2', 'l1']);
    expect(equal.items.map(({ id }) => id)).toEqual(['l2']);
  });

  it('asks the node to wait for the refresh only when the option says so', async () => {
    const waiting = recorded(current().node.transport);
    const atOnce = recorded(current().node.transport);
    const name = aReadModelName();
    const store = ledgerOf(current(), name, waiting);

    const eventual = new OpenSearchReadModelStore<Ledger>({
      transport: atOnce,
      name,
      definition: ledger,
      fields: { note: 'string', closedAt: 'instant' },
    });

    await store.ensureMapping();
    await store.upsertIfNewer('l1', stamp, () => ({ id: 'l1', amount: '1', note: 'n', closedAt: null }));
    await eventual.upsertIfNewer('l2', stamp, () => ({ id: 'l2', amount: '2', note: 'n', closedAt: null }));

    const writes = (sent: readonly OpenSearchRequest[]) =>
      sent.filter(({ path }) => path.includes('/_doc/')).filter(({ method }) => method === 'PUT');

    expect(writes(waiting.sent).map(({ query }) => query?.['refresh'])).toEqual(['wait_for']);
    expect(writes(atOnce.sent).map(({ query }) => query?.['refresh'])).toEqual([undefined]);
  });
});

onEachNode('OpenSearchReadModelStore, versions and rebuild', (current) => {
  it('replaces a row only while it holds the stamp that was read, whoever read it', async () => {
    const { store } = await mapped(current());

    await store.table.insert({ key: row.id, row, stamp });

    expect(await store.table.replace({ key: row.id, row: { ...row, seats: 7 }, stamp: later }, { ...stamp })).toBe(
      true,
    );

    expect(await store.table.replace({ key: row.id, row: { ...row, seats: 8 }, stamp: later }, { ...stamp })).toBe(
      false,
    );

    expect(await store.table.replace({ key: 'a9', row, stamp: later }, { ...stamp })).toBe(false);
    expect((await store.get(row.id))?.seats).toBe(7);
  });

  it('gives up with a concurrency error when every write it tries meets a conflict', async () => {
    const name = aReadModelName();
    const { store } = await mapped(current(), { name });

    const contended = new OpenSearchReadModelStore<CriteriaContractRow>({
      transport: recorded(current().node.transport, true),
      name,
      definition: store.definition,
    });

    await store.upsertIfNewer(row.id, stamp, () => row);

    await expect(contended.upsertIfNewer(row.id, later, () => row)).rejects.toThrow(ConcurrencyError);
  });

  it('refuses a mapping the index cannot take, and the provisioning of the other strategy', async () => {
    const name = aReadModelName();

    await ledgerOf(current(), name).ensureMapping();

    const changed = new OpenSearchReadModelStore<Ledger>({
      transport: current().node.transport,
      name,
      definition: ledger,
      fields: { note: 'number' },
    });

    await expect(changed.ensureMapping()).rejects.toThrow(OpenSearchRequestError);
    await expect(changed.provision('acme')).rejects.toThrow('ensureMapping()');
    await expect(readModelOf(current().node, 'index').store.ensureMapping()).rejects.toThrow('provision(tenant)');
  });

  it('has no rebuild yet, and says so at each step', async () => {
    const { store } = await mapped(current());
    const { table } = store;

    expect(await table.rebuilding()).toBe(false);

    await expect(
      new ProjectionRebuild({
        table,
        source: new SourceOfTruth<CriteriaContractRow>(),
        unitOfWork: new InMemoryUnitOfWork(),
      }).run(),
    ).rejects.toThrow(UnsupportedRebuildError);

    const steps = [table.touch('a1'), table.touched(1), table.settle([]), table.holdWriters(), table.promote()];

    for (const step of await Promise.allSettled(steps)) {
      expect(step.status === 'rejected' && step.reason instanceof UnsupportedRebuildError).toBe(true);
    }

    expect(() => table.shadow()).toThrow(UnsupportedRebuildError);
  });
});

describe('OpenSearchReadModelStore, declared', () => {
  const transport: OpenSearchTransport = { request: () => Promise.reject(new Error('no request is sent')) };

  it('refuses a read model name or a field an index cannot hold as it is', () => {
    const declare = (name: string, fields: Readonly<Record<string, 'string' | 'number'>> = {}, field?: string) =>
      new OpenSearchReadModelStore<Ledger>({
        transport,
        name,
        definition: ledger,
        fields,
        ...(field === undefined ? {} : { tenancy: { strategy: 'attribute', scope, field } }),
      });

    expect(() => declare('Ledger')).toThrow(InvalidIndexNameError);
    expect(() => declare('ledger-eu')).toThrow(InvalidIndexNameError);
    expect(() => declare('ledger', { _ddd_note: 'string' })).toThrow('_ddd_');
    expect(() => declare('ledger', { 'note.text': 'string' })).toThrow('a dot');
    expect(() => declare('ledger', { owner: 'number' }, 'owner')).toThrow('holds a string');
  });

  it('orders decimals by their keys as numbers, and refuses what is no decimal', () => {
    const written = ['-12.5', '-12.25', '-1', '-0.5', '0', '0.000', '0.49', '0.5', '1', '9.99', '10', '10.5'];
    const keys = written.map(decimalKey);

    expect([...keys].sort()).toEqual(keys);
    expect(decimalKey('0')).toBe(decimalKey('-0.0'));
    expect(decimalKey('10.50')).toBe(decimalKey('10.5'));
    expect(() => decimalKey('1e3')).toThrow(TypeError);
    expect(() => decimalKey('1'.repeat(1000))).toThrow('at most 999');
  });
});
