import { createServer } from 'node:net';
import { defineCriteria } from '@ddd-ts-kit/kernel';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OpenSearchReadModelStore, OpenSearchRequestError, OpenSearchUnavailableError, fetchTransport } from '../src';
import { OpenSearchServer } from './support/fake/open-search-server';

const CREDENTIALS = { username: 'kit', password: 'secret' };
const definition = defineCriteria<{ readonly id: string }>({ fields: { id: { type: 'string' } }, tieBreaker: 'id' });

describe('fetchTransport', () => {
  let server: OpenSearchServer;

  beforeAll(async () => {
    server = await OpenSearchServer.start(CREDENTIALS);
  });

  beforeEach(() => {
    server.mood = 'answering';
  });

  afterAll(async () => {
    await server.stop();
  });

  const storeOn = (transport: ReturnType<typeof fetchTransport>) =>
    new OpenSearchReadModelStore<{ readonly id: string }>({ transport, name: 'transported', definition });

  it('sends the whole authorization header it is given', async () => {
    const authorization = `Basic ${Buffer.from('kit:secret').toString('base64')}`;

    const answer = await fetchTransport({ node: server.url, auth: { authorization } }).request({
      method: 'PUT',
      path: '/given',
      body: {},
    });

    expect(answer).toEqual({ status: 200, body: { acknowledged: true, index: 'given' } });
  });

  it('reaches the same path when the node URL ends with slashes', async () => {
    const answer = await fetchTransport({ node: `${server.url}///`, auth: CREDENTIALS }).request({
      method: 'GET',
      path: '/given',
    });

    expect(answer).toMatchObject({ status: 200, body: { given: { mappings: { properties: {} } } } });
  });

  it('answers a refusal of the credentials as a status, which the store names', async () => {
    const answer = await fetchTransport({ node: server.url }).request({ method: 'GET', path: '/given' });

    const refusal = await storeOn(fetchTransport({ node: server.url, auth: { ...CREDENTIALS, password: 'wrong' } }))
      .ensureMapping()
      .catch((error: unknown) => error);

    expect(answer.status).toBe(401);
    expect(refusal).toBeInstanceOf(OpenSearchRequestError);

    expect(String(refusal)).toContain(
      'OpenSearch answered 401 to PUT /transported.v1: security_exception, missing authentication credentials',
    );
  });

  it('reads the page of a proxy as no body, and the store refuses it by its status alone', async () => {
    server.mood = 'behind a proxy';

    const answer = await fetchTransport({ node: server.url }).request({ method: 'GET', path: '/given' });

    const refusal = await storeOn(fetchTransport({ node: server.url }))
      .get('a1')
      .catch((error: unknown) => error);

    expect(answer).toEqual({ status: 502, body: undefined });
    expect(String(refusal)).toContain('OpenSearch answered 502 to GET /transported/_doc/a1');
    expect(String(refusal)).not.toContain('html');
  });

  it('abandons a request past its timeout', async () => {
    server.mood = 'silent';

    const refusal = await fetchTransport({ node: server.url, timeoutMs: 50 })
      .request({ method: 'GET', path: '/given' })
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(OpenSearchUnavailableError);
    expect((refusal as OpenSearchUnavailableError).code).toBe('OPENSEARCH_UNAVAILABLE');
  });

  it('rejects when no node listens', async () => {
    const port = await aClosedPort();

    const refusal = await fetchTransport({ node: `http://127.0.0.1:${String(port)}` })
      .request({ method: 'GET', path: '/given' })
      .catch((error: unknown) => error);

    expect(String(refusal)).toContain('OpenSearch did not answer GET /given');
  });
});

/** A port that was free a moment ago and that nothing listens on. */
async function aClosedPort(): Promise<number> {
  const probe = createServer();

  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));

  const address = probe.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  await new Promise<void>((resolve) => probe.close(() => resolve()));

  return port;
}
