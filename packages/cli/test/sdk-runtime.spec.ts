import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { SHOP_CONTRACT } from './support/shop-contract.js';
import { writtenClient } from './support/written-client.js';

interface Sent {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/** The generated module, loaded as its consumer loads it: its exports are what the spec calls. */
type ShopModule = Record<string, unknown>;

describe('a generated client, called', () => {
  let shop: ShopModule;

  beforeAll(async () => {
    const root = writtenClient(SHOP_CONTRACT, 'shop-api-client');

    shop = (await import(path.join(root, 'src/index.ts'))) as ShopModule;
  });

  function client(answer: () => Response, credentials: Record<string, unknown> = {}) {
    const fake = fakeFetch(answer);

    const create = shop['createClient'] as (
      options: unknown,
    ) => Record<string, (...args: unknown[]) => Promise<unknown>>;

    return {
      api: create({ baseUrl: 'https://shop.test/v1/', credentials, fetch: fake.fetch, headers: { 'x-app': 'spec' } }),
      sent: fake.sent,
    };
  }

  it('sends the path, the query and the declared headers, with the credentials the security names', async () => {
    const { api, sent } = client(() => json(200, { lines: [] }), { bearer: async () => 'token' });

    const result = await api['getOrder']?.(
      { path: { orderId: 'a/b' }, query: { expand: ['lines', 'payer'] }, header: { 'X-Trace': 7 } },
      { headers: { 'accept-language': 'fr' } },
    );

    expect(sent[0]).toMatchObject({
      method: 'GET',
      url: 'https://shop.test/v1/orders/a%2Fb?expand=lines&expand=payer',
      headers: { authorization: 'Bearer token', 'x-trace': '7', 'x-app': 'spec', 'accept-language': 'fr' },
    });

    expect(result).toMatchObject({ ok: true, status: 200, data: { lines: [] } });
  });

  it('sends a JSON body and every scheme of the alternative, the cookie among them', async () => {
    const { api, sent } = client(() => json(201, { id: 'o-1' }), { bearer: 'token', tenant: 'acme' });

    expect(await api['placeOrder']?.({ body: { lines: [{ sku: 'A' }] } })).toMatchObject({
      ok: true,
      data: { id: 'o-1' },
    });

    expect(sent[0]).toMatchObject({
      method: 'POST',
      body: '{"lines":[{"sku":"A"}]}',
      headers: { 'content-type': 'application/json', cookie: 'tenant=acme', authorization: 'Bearer token' },
    });
  });

  it('goes anonymous when an alternative allows it and no credential is given, a key in the query otherwise', async () => {
    const anonymous = client(() => new Response(null, { status: 204 }));

    expect(await anonymous.api['cancelOrder']?.({ path: { orderId: '1' } })).toMatchObject({ ok: true, status: 204 });
    expect(anonymous.sent[0]?.url).toBe('https://shop.test/v1/orders/1');

    const keyed = client(() => new Response(null, { status: 204 }), { key: () => 'k 1' });

    await keyed.api['cancelOrder']?.({ path: { orderId: '1' } });
    expect(keyed.sent[0]?.url).toBe('https://shop.test/v1/orders/1?api_key=k+1');
  });

  it('answers a declared refusal as its problem document, and unwrap throws it with its code', async () => {
    const problem = { code: 'ORDER_NOT_FOUND', status: 404 };
    const { api } = client(() => json(404, problem, 'application/problem+json'));

    expect(await api['getOrder']?.({ path: { orderId: '1' } })).toMatchObject({ ok: false, status: 404, problem });

    const unwrap = shop['unwrap'] as (result: unknown) => Promise<unknown>;
    const isProblem = shop['isProblem'] as (error: unknown, ...codes: string[]) => boolean;
    const thrown = await unwrap(api['getOrder']?.({ path: { orderId: '1' } })).catch((error: unknown) => error);

    expect(thrown).toMatchObject({ name: 'ProblemError', status: 404, code: 'ORDER_NOT_FOUND', problem });

    expect([isProblem(thrown), isProblem(thrown, 'ORDER_NOT_FOUND'), isProblem(thrown, 'DUPLICATE')]).toEqual([
      true,
      true,
      false,
    ]);

    expect(isProblem(new Error('x'))).toBe(false);
  });

  it('reads a text answer and a success through unwrap', async () => {
    const unwrap = shop['unwrap'] as (result: unknown) => Promise<unknown>;
    const { api } = client(() => new Response('alive', { status: 200 }));

    expect(await unwrap(api['getHealth']?.())).toBe('alive');
  });

  it('throws on a status the contract does not declare', async () => {
    const { api } = client(() => new Response('boom', { status: 500 }));

    await expect(api['getHealth']?.()).rejects.toMatchObject({
      name: 'UnexpectedResponseError',
      status: 500,
      body: 'boom',
    });
  });

  it('calls the global fetch when it is given none, and can be used one operation at a time', async () => {
    const connect = shop['connect'] as (options: unknown) => unknown;
    const getHealth = shop['getHealth'] as (connection: unknown) => Promise<unknown>;
    const original = globalThis.fetch;

    globalThis.fetch = async () => new Response('', { status: 200 });

    try {
      expect(await getHealth(connect({ baseUrl: 'https://shop.test' }))).toMatchObject({ ok: true, data: '' });
    } finally {
      globalThis.fetch = original;
    }
  });
});

/** A fetch that records what it is given and answers what the spec says, a new response each time. */
function fakeFetch(answer: () => Response): { fetch: (request: Request) => Promise<Response>; sent: Sent[] } {
  const sent: Sent[] = [];

  return {
    sent,
    fetch: async (request) => {
      sent.push({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers),
        body: await request.text(),
      });

      return answer();
    },
  };
}

function json(status: number, body: unknown, type = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
}
