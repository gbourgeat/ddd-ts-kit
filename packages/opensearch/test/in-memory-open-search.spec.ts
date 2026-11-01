import { describe, expect, it } from 'vitest';
import { InMemoryOpenSearch } from '../src/testing';
import type { OpenSearchRequest, OpenSearchResponse } from '../src';

const MAPPING = {
  mappings: {
    properties: {
      name: { type: 'keyword' },
      amount: { type: 'double' },
      at: { type: 'date' },
      paid: { type: 'boolean' },
      address: { properties: { city: { type: 'keyword' } } },
      raw: { type: 'binary' },
    },
  },
};

/** A node with the index `invoices.v1` and its write alias `invoices`. */
async function aNode(): Promise<InMemoryOpenSearch> {
  const node = new InMemoryOpenSearch();

  await node.request({ method: 'PUT', path: '/invoices.v1', body: MAPPING });

  await node.request({
    method: 'POST',
    path: '/_aliases',
    body: { actions: [{ add: { index: 'invoices.v1', alias: 'invoices' } }] },
  });

  return node;
}

function errorOf(response: OpenSearchResponse): unknown {
  return Reflect.get(Object(response.body), 'error');
}

const put = (node: InMemoryOpenSearch, id: string, body: object): Promise<OpenSearchResponse> =>
  node.request({ method: 'PUT', path: `/invoices/_doc/${id}`, body });

const search = (node: InMemoryOpenSearch, body: object, path = '/invoices/_search'): Promise<OpenSearchResponse> =>
  node.request({ method: 'POST', path, body } satisfies OpenSearchRequest);

const ids = (response: OpenSearchResponse): unknown =>
  (Reflect.get(Object(Reflect.get(Object(response.body), 'hits')), 'hits') as { _id: string }[]).map(({ _id }) => _id);

describe('InMemoryOpenSearch, the indices and their mapping', () => {
  it('refuses an index name OpenSearch refuses, and a name longer than 255', async () => {
    const node = new InMemoryOpenSearch();

    expect((await node.request({ method: 'PUT', path: '/Invoices' })).status).toBe(400);

    expect(errorOf(await node.request({ method: 'PUT', path: `/${'a'.repeat(256)}` }))).toMatchObject({
      type: 'invalid_index_name_exception',
    });
  });

  it('adds a field the mapping lacks, merges an object field, refuses a field mapped otherwise', async () => {
    const node = await aNode();

    const mapped = (properties: object): Promise<OpenSearchResponse> =>
      node.request({ method: 'PUT', path: '/invoices.v1/_mapping', body: { properties } });

    expect((await mapped({ notes: { type: 'keyword' } })).status).toBe(200);
    expect((await mapped({ address: { properties: { zip: { type: 'keyword' } } } })).status).toBe(200);

    expect(errorOf(await mapped({ amount: { type: 'keyword' } }))).toMatchObject({
      type: 'illegal_argument_exception',
    });

    expect(errorOf(await mapped({ address: { type: 'keyword' } }))).toMatchObject({
      type: 'illegal_argument_exception',
    });

    expect(await node.request({ method: 'GET', path: '/invoices.v1' })).toMatchObject({ status: 200 });
  });

  it('refuses a value its field cannot hold, and keeps one of a type it does not check', async () => {
    const node = await aNode();

    expect(errorOf(await put(node, 'i1', { address: 'Paris' }))).toMatchObject({ type: 'mapper_parsing_exception' });
    expect(errorOf(await put(node, 'i2', { amount: 'ten' }))).toMatchObject({ type: 'mapper_parsing_exception' });
    expect((await put(node, 'i3', { raw: 'AAEC', address: { city: 'Lyon' } })).status).toBe(201);
    expect((await node.request({ method: 'POST', path: '/invoices.v1/_refresh' })).status).toBe(200);
  });
});

describe('InMemoryOpenSearch, a request it cannot read', () => {
  it('rejects with the error itself, as a broken transport would, rather than answering it', async () => {
    await expect(new InMemoryOpenSearch().request({ method: 'GET', path: '/%E0%A4%A' })).rejects.toThrow(URIError);
  });
});

describe('InMemoryOpenSearch, the aliases', () => {
  it('reads an action list that is missing or holds no add, and refuses an alias named as an index', async () => {
    const node = await aNode();

    const aliases = (body: object): Promise<OpenSearchResponse> =>
      node.request({ method: 'POST', path: '/_aliases', body });

    expect((await aliases({})).status).toBe(200);
    expect(errorOf(await aliases({ actions: [{ remove: {} }] }))).toMatchObject({ type: 'index_not_found_exception' });

    expect(
      errorOf(await aliases({ actions: [{ add: { index: 'invoices.v1', alias: 'invoices.v1' } }] })),
    ).toMatchObject({
      type: 'invalid_alias_name_exception',
    });
  });

  it('writes to an index named directly, and refuses an alias of two indices as a write target', async () => {
    const node = await aNode();

    await node.request({ method: 'PUT', path: '/archive.v1', body: MAPPING });

    await node.request({
      method: 'POST',
      path: '/_aliases',
      body: { actions: [{ add: { index: 'archive.v1', alias: 'invoices' } }] },
    });

    expect((await node.request({ method: 'PUT', path: '/archive.v1/_doc/a1', body: { name: 'a' } })).status).toBe(201);
    expect(errorOf(await put(node, 'i1', { name: 'b' }))).toMatchObject({ type: 'illegal_argument_exception' });
  });

  it('skips a missing index of a search that ignores it, and answers 404 otherwise', async () => {
    const node = await aNode();

    expect(
      (await node.request({ method: 'POST', path: '/gone/_search', query: { ignore_unavailable: 'true' } })).status,
    ).toBe(200);

    expect((await node.request({ method: 'POST', path: '/gone/_search' })).status).toBe(404);
  });
});

describe('InMemoryOpenSearch, the queries', () => {
  it('answers 400 to a query of the DSL it does not know', async () => {
    const node = await aNode();

    await put(node, 'i1', { name: 'a' });

    expect(errorOf(await search(node, { query: { fuzzy: { name: 'x' } } }))).toMatchObject({
      type: 'parsing_exception',
    });
  });

  it('reads an empty query, a clause with no field, a single bool clause and terms without a list', async () => {
    const node = await aNode();

    await put(node, 'i1', { name: 'a', paid: true });
    await put(node, 'i2', { name: 'b', paid: false });

    expect(ids(await search(node, { query: {} }))).toEqual(['i1', 'i2']);
    expect(ids(await search(node, { query: { term: 'name' } }))).toEqual([]);
    expect(ids(await search(node, { query: { bool: { filter: { term: { name: 'a' } } } } }))).toEqual(['i1']);
    expect(ids(await search(node, { query: { terms: { name: 'a' } } }))).toEqual([]);
    expect(ids(await search(node, { query: { term: { 'address.city': 'x' } } }))).toEqual([]);
  });

  it('matches a wildcard with an escaped character and a single character', async () => {
    const node = await aNode();

    await put(node, 'i1', { name: 'a*b' });
    await put(node, 'i2', { name: 'axb' });

    expect(ids(await search(node, { query: { wildcard: { name: { value: 'a\\*?' } } } }))).toEqual(['i1']);
    expect(ids(await search(node, { query: { wildcard: { name: { value: 'a\\*b' } } } }))).toEqual(['i1']);
    expect(ids(await search(node, { query: { wildcard: { name: { value: 'a?b' } } } }))).toEqual(['i1', 'i2']);
  });

  it('keeps the order of the documents that tie on every sort key, a nested key read by its type', async () => {
    const node = await aNode();

    await put(node, 'i1', { name: 'a', address: { city: 'Lyon' } });
    await put(node, 'i2', { name: 'a', address: { city: 'Lyon' } });

    expect(
      ids(await search(node, { sort: [{ name: { order: 'asc' } }, { 'address.city': { order: 'desc' } }] })),
    ).toEqual(['i1', 'i2']);
  });
});
