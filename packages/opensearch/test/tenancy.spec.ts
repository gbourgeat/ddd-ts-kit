import { Criteria, NoCurrentTenantError, scoped, type EventStamp, type TenantElevation } from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant } from '@ddd-ts-kit/testing';
import { criteriaContractRows, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { expect, it } from 'vitest';
import { InvalidIndexNameError, UnprovisionedIndexError } from '../src';
import { provisioned, readModelOf, scope, type ReadModelUnderTest } from './support/read-models';
import { onEachNode, type NodeUnderTest } from './support/on-each-node';

type Row = CriteriaContractRow;

const stamp: EventStamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };
const [first, second] = criteriaContractRows();
const row: Row = { ...(first ?? criteriaContractRows()[0]), tenantId: 'globex' } as Row;
const other: Row = second ?? row;

const everything = Criteria.of<Row>().orderBy('id');

function put(tenant: string, model: ReadModelUnderTest, written: Row, at: EventStamp = stamp): Promise<string> {
  return asTenant(scope, tenant, () => model.store.upsertIfNewer(written.id, at, () => written));
}

function ids(tenant: string, model: ReadModelUnderTest): Promise<string[]> {
  return asTenant(scope, tenant, () => model.store.search(scoped(everything, { kind: 'all' }))).then((page) =>
    page.items.map(({ id }) => id),
  );
}

function elevated<T>(tenants: TenantElevation['tenants'], work: () => Promise<T>): Promise<T> {
  const staff = anExecutionContext().ofTenant('initech').build();

  return scope.run(Object.freeze({ ...staff, elevation: { reason: 'SUPPORT_TICKET', tenants } }), work);
}

async function readModel(
  { node, created }: NodeUnderTest,
  strategy: 'index' | 'attribute',
  field?: string,
): Promise<ReadModelUnderTest> {
  const model = readModelOf(node, strategy, field === undefined ? {} : { tenancy: { strategy, scope, field } });

  created.push(...model.indices);

  return provisioned(model, strategy);
}

for (const strategy of ['index', 'attribute'] as const) {
  onEachNode(`OpenSearchReadModelStore, tenants apart in one ${strategy}`, (current) => {
    it('shows each tenant its own rows, under one key in both', async () => {
      const model = await readModel(current(), strategy);

      await put('acme', model, row);
      await put('globex', model, { ...row, title: 'globex title' });

      expect((await asTenant(scope, 'acme', () => model.store.get(row.id)))?.title).toBe(row.title);
      expect((await asTenant(scope, 'globex', () => model.store.get(row.id)))?.title).toBe('globex title');
    });

    it('never answers a search with the rows of another tenant', async () => {
      const model = await readModel(current(), strategy);

      await put('acme', model, row);
      await put('globex', model, other);

      const theirs = Criteria.of<Row>().where('id', 'eq', other.id);

      expect(await ids('acme', model)).toEqual([row.id]);
      expect(await ids('globex', model)).toEqual([other.id]);

      expect((await asTenant(scope, 'acme', () => model.store.search(scoped(theirs, { kind: 'all' })))).items).toEqual(
        [],
      );
    });

    it('lets a tenant change and delete its own rows only', async () => {
      const model = await readModel(current(), strategy);
      const later = { eventId: 'evt-2', occurredAt: new Date('2026-10-10T12:01:00.000Z') };

      await put('acme', model, row);
      await put('globex', model, row);
      await asTenant(scope, 'globex', () => model.store.delete(row.id, later));

      await put(
        'globex',
        model,
        { ...row, title: 'changed' },
        { eventId: 'evt-3', occurredAt: new Date('2026-10-10T12:02:00.000Z') },
      );

      expect(await asTenant(scope, 'acme', () => model.store.get(row.id))).toEqual({ ...row, tenantId: 'globex' });
      expect((await asTenant(scope, 'globex', () => model.store.get(row.id)))?.title).toBe('changed');
    });

    it('writes the tenant of the work in the tenant field, whatever the row says', async () => {
      const model = await readModel(current(), strategy, 'tenantId');

      await put('acme', model, row);

      expect((await asTenant(scope, 'acme', () => model.store.get(row.id)))?.tenantId).toBe('acme');
      expect(await asTenant(scope, 'globex', () => model.store.get(row.id))).toBeUndefined();
    });
  });

  onEachNode(`OpenSearchReadModelStore, elevations and refusals in one ${strategy}`, (current) => {
    it('widens a search under an elevation, to every tenant or to those it names, and no get nor write', async () => {
      const model = await readModel(current(), strategy);

      await put('acme', model, row);
      await put('globex', model, other);

      const across = (tenants: TenantElevation['tenants']) =>
        elevated(tenants, () => model.store.search(scoped(everything, { kind: 'all' }))).then((page) =>
          page.items.map(({ id }) => id),
        );

      expect(await across('all')).toEqual([row.id, other.id].sort());
      expect(await across(['globex', 'hooli'])).toEqual([other.id]);

      // A get and a write reach the tenant of the work, which was never provisioned here.
      await expect(elevated('all', () => model.store.get(row.id))).rejects.toThrow(UnprovisionedIndexError);

      await expect(elevated('all', () => model.store.upsertIfNewer(row.id, stamp, () => row))).rejects.toThrow(
        UnprovisionedIndexError,
      );

      expect(await asTenant(scope, 'acme', () => model.store.get(row.id))).toEqual(row);
    });

    it('refuses work that names no tenant, and a tenant never provisioned, without creating an index', async () => {
      const model = await readModel(current(), strategy);
      const job = anExecutionContext().build();

      await expect(scope.run(job, () => model.store.get(row.id))).rejects.toThrow(NoCurrentTenantError);

      await expect(scope.run(job, () => model.store.search(scoped(everything, { kind: 'all' })))).rejects.toThrow(
        NoCurrentTenantError,
      );

      await expect(scope.run(job, () => model.store.upsertIfNewer(row.id, stamp, () => row))).rejects.toThrow(
        NoCurrentTenantError,
      );

      await expect(put('hooli', model, row)).rejects.toThrow(UnprovisionedIndexError);
      await expect(ids('hooli', model)).rejects.toThrow(UnprovisionedIndexError);

      const index = await current().node.transport.request({ method: 'GET', path: `/${model.name}-hooli` });

      expect(index.status).toBe(404);
    });

    it('refuses a tenant whose name an index cannot hold, rather than altering it', async () => {
      const model = await readModel(current(), strategy);

      await expect(model.store.provision('Acme')).rejects.toThrow(InvalidIndexNameError);
      await expect(asTenant(scope, 'Acme', () => model.store.get(row.id))).rejects.toThrow(InvalidIndexNameError);

      await expect(elevated(['Acme'], () => model.store.search(scoped(everything, { kind: 'all' })))).rejects.toThrow(
        InvalidIndexNameError,
      );
    });

    it('provisions a tenant again without harm', async () => {
      const model = await readModel(current(), strategy);

      await put('acme', model, row);
      await model.store.provision('acme');

      expect(await asTenant(scope, 'acme', () => model.store.get(row.id))).toEqual(row);
    });
  });
}

onEachNode('OpenSearchReadModelStore, aliases and indices', (current) => {
  it('keeps a tenant to its documents in OpenSearch itself, through the filtered alias of the shared index', async () => {
    const model = await readModel(current(), 'attribute');

    await put('acme', model, row);
    await put('globex', model, other);

    const searched = await current().node.transport.request({
      method: 'POST',
      path: `/${model.name}-acme/_search`,
      body: { query: { match_all: {} } },
    });

    expect(JSON.stringify(searched.body)).toContain(`"acme:${row.id}"`);
    expect(JSON.stringify(searched.body)).not.toContain('"owner":"globex"');
    expect(JSON.stringify(searched.body)).not.toContain(`:${other.id}"`);
  });

  it('keeps each tenant in an index of its own under the index strategy', async () => {
    const model = await readModel(current(), 'index');

    await put('globex', model, other);

    const index = await current().node.transport.request({
      method: 'POST',
      path: `/${model.name}-acme.v1/_search`,
      body: {},
    });

    expect(JSON.stringify(index.body)).not.toContain(other.id);
  });
});
