import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openFgaClient } from '../src/sdk';

/** One request as the server of the spec saw it. */
interface Seen {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
  readonly body: unknown;
}

const tuple = { user: 'user:ada', relation: 'editor', object: 'document:1' };
/** The identifiers OpenFGA hands out are ULIDs, and the SDK refuses any other shape before it calls. */
const STORE = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER_STORE = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const MODEL = '01ARZ3NDEKTSV4RRFFQ69G5FAX';

describe('openFgaClient', () => {
  const seen: Seen[] = [];
  let server: Server;
  let apiUrl: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      let text = '';

      request.setEncoding('utf8');
      request.on('data', (chunk: string) => void (text += chunk));

      request.on('end', () => {
        seen.push({
          method: request.method ?? '',
          path: request.url ?? '',
          authorization: request.headers.authorization,
          body: text === '' ? undefined : JSON.parse(text),
        });

        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ allowed: true }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    apiUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('binds the client of the SDK to the store, the model it pins and the token it is given', async () => {
    seen.length = 0;
    const client = openFgaClient({ apiUrl, storeId: STORE, authorizationModelId: MODEL, apiToken: 'secret' });

    expect(await client.check(tuple)).toMatchObject({ allowed: true });

    expect(seen).toEqual([
      {
        method: 'POST',
        path: `/stores/${STORE}/check`,
        authorization: 'Bearer secret',
        body: expect.objectContaining({ authorization_model_id: MODEL, tuple_key: tuple }),
      },
    ]);
  });

  it('pins no model and sends no credential when given none: the latest model of the store decides', async () => {
    seen.length = 0;
    const client = openFgaClient({ apiUrl, storeId: OTHER_STORE });

    await client.check(tuple);

    expect(seen[0]).toMatchObject({ path: `/stores/${OTHER_STORE}/check`, authorization: undefined });
    expect(seen[0]?.body).not.toHaveProperty('authorization_model_id');
  });
});
