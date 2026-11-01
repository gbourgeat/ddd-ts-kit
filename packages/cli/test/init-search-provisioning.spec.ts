import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OpenSearchReadModelStore, type OpenSearchReadModelOptions } from '@ddd-ts-kit/opensearch';
import { OpenSearchServer } from '../../opensearch/test/support/fake/open-search-server';
import {
  ListedTenants,
  asTenant,
  generatedSearch,
  invoiceCriteria,
  logger,
  scope,
  type InvoiceRow,
} from './support/generated-search';

const CREDENTIALS = { username: 'app', password: 'app-secret' };
const stamp = { eventId: 'evt-1', occurredAt: new Date(0) };
const row = (id: string): InvoiceRow => ({ id, status: 'issued' });

let server: OpenSearchServer;
let counter = 0;

const aName = (): string => {
  counter += 1;

  return `billing_invoices_${String(counter)}`;
};

const storeOf = (options: object): OpenSearchReadModelStore<InvoiceRow> =>
  new OpenSearchReadModelStore(options as OpenSearchReadModelOptions<InvoiceRow>);

const nodeOf = () => ({ node: server.url, ...CREDENTIALS });

const aliasesOf = (name: string): string[] =>
  server.node.requests
    .filter(({ method, path }) => method === 'POST' && path === '/_aliases')
    .flatMap(({ body }) => JSON.stringify(body).match(new RegExp(`${name}-[a-z0-9_-]+`, 'g')) ?? []);

beforeAll(async () => {
  server = await OpenSearchServer.start(CREDENTIALS);
});

afterAll(async () => {
  await server.stop();
});

describe('the search platform of a generated project under shared tables', () => {
  let openSearch: Awaited<ReturnType<typeof generatedSearch>>;

  beforeAll(async () => {
    openSearch = await generatedSearch('--tenancy', 'shared-table');
  }, 60_000);

  it('provisions a tenant the directory lists at its first request, a store built after the start included', async () => {
    const directory = new ListedTenants('acme');
    const search = openSearch(nodeOf(), { logger: logger(), scope, directory });

    await search.provision();
    directory.ids.push('globex');

    const name = aName();
    const list = storeOf(search.options(name, invoiceCriteria, { refresh: 'wait_for' }));

    await asTenant('globex', () => list.upsertIfNewer('i1', stamp, () => row('i1')));

    expect(await asTenant('globex', () => list.get('i1'))).toEqual(row('i1'));
    expect(aliasesOf(name)).toEqual([`${name}-globex`]);
  });

  it('provisions nothing for a tenant the directory does not list, and the store refuses it', async () => {
    const search = openSearch(nodeOf(), { logger: logger(), scope, directory: new ListedTenants('acme') });
    const name = aName();
    const list = storeOf(search.options(name, invoiceCriteria));

    await expect(asTenant('forged', () => list.get('i1'))).rejects.toMatchObject({ name: 'UnprovisionedIndexError' });
    expect(aliasesOf(name)).toEqual([]);
  });

  it('provisions nothing for work under an elevation', async () => {
    const search = openSearch(nodeOf(), { logger: logger(), scope, directory: new ListedTenants('acme') });
    const name = aName();
    const list = storeOf(search.options(name, invoiceCriteria));

    await expect(asTenant('acme', () => list.get('i1'), true)).rejects.toMatchObject({
      name: 'UnprovisionedIndexError',
    });

    expect(aliasesOf(name)).toEqual([]);
  });

  it('keeps the failure of one tenant its own, and provisions each other tenant once', async () => {
    const search = openSearch(nodeOf(), { logger: logger(), scope, directory: new ListedTenants('Acme', 'globex') });
    const name = aName();
    const list = storeOf(search.options(name, invoiceCriteria));

    await expect(asTenant('Acme', () => list.get('i1'))).rejects.toMatchObject({ name: 'InvalidIndexNameError' });
    await asTenant('globex', () => list.get('i1'));
    await asTenant('globex', () => list.get('i2'));

    expect(aliasesOf(name)).toEqual([`${name}-globex`]);
  });

  it('warns and goes on when the node fails at the start, then provisions at the next request', async () => {
    const warned = logger();

    const failing = openSearch(
      { node: 'http://127.0.0.1:1' },
      { logger: warned, scope, directory: new ListedTenants('acme') },
    );

    storeOf(failing.options(aName(), invoiceCriteria));

    await expect(failing.provision()).resolves.toBeUndefined();

    expect(warned.entries.map(({ level, message }) => [level, message])).toEqual([
      ['warn', 'search index not provisioned'],
    ]);
  });

  it('calls nothing at the start without a node, and refuses a request of a store', async () => {
    const quiet = logger();
    const search = openSearch(undefined, { logger: quiet, scope, directory: new ListedTenants('acme') });
    const list = storeOf(search.options(aName(), invoiceCriteria));

    await expect(search.provision()).resolves.toBeUndefined();
    expect(quiet.entries).toEqual([]);
    await expect(asTenant('acme', () => list.get('i1'))).rejects.toMatchObject({ name: 'OpenSearchUnavailableError' });
  });

  it('builds a name twice from the same definition, and refuses it with another', () => {
    const search = openSearch(nodeOf(), { logger: logger(), scope, directory: new ListedTenants() });
    const name = aName();

    search.options(name, invoiceCriteria, { fields: { notes: 'string' } });

    expect(() => search.options(name, invoiceCriteria, { fields: { notes: 'string' } })).not.toThrow();

    expect(() => search.options(name, invoiceCriteria, { fields: { notes: 'number' } })).toThrow(
      expect.objectContaining({ name: 'SearchNameTakenError' }),
    );
  });
});

describe('the search platform of a generated project without tenancy', () => {
  it('maps the index of a store once, at its first request', async () => {
    const openSearch = await generatedSearch();
    const search = openSearch(nodeOf(), { logger: logger() });
    const name = aName();
    const list = storeOf(search.options(name, invoiceCriteria));

    await list.get('i1');
    await list.get('i2');

    expect(server.node.requests.filter(({ method, path }) => method === 'PUT' && path === `/${name}.v1`)).toHaveLength(
      1,
    );
  }, 60_000);
});
