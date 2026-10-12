import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { followServed, followWithFetch } from '../src/contracts.js';
import { readAll } from '../src/contracts/file-storage/read-all.js';
import { tampered } from '../src/contracts/file-storage/tampered.js';

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => chunks.push(chunk));

    request.on('end', () => {
      response.setHeader('X-Method', request.method ?? '');
      response.end(Buffer.concat(chunks).length === 0 ? 'nothing sent' : Buffer.concat(chunks));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(() => {
  server.close();
});

describe('following a signed link', () => {
  it('sends the request over the network, body and headers included, and reads the answer whole', async () => {
    const sent = await followWithFetch({
      url: `${base}/up`,
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: Buffer.from('notes'),
    });

    const read = await followWithFetch({ url: `${base}/down`, method: 'GET' });

    expect([sent.status, Buffer.from(sent.body).toString(), sent.headers['x-method']]).toEqual([200, 'notes', 'PUT']);
    expect(Buffer.from(read.body).toString()).toBe('nothing sent');
  });

  it('answers 403 for a link the application does not grant, whatever its form', async () => {
    const follow = followServed(new InMemoryFileStorage());

    expect((await follow({ url: 'http://localhost/files/forged', method: 'GET' })).status).toBe(403);
    expect((await follow({ url: 'http://localhost/files/forged', method: 'PUT' })).status).toBe(403);
    expect((await follow({ url: 'http://localhost/', method: 'GET' })).status).toBe(403);
  });

  it('reads chunks of every kind, and changes the last character of any link', async () => {
    expect(
      Buffer.from(
        await readAll(Readable.from(['a', new Uint8Array([98]), Buffer.from('c')], { objectMode: true })),
      ).toString(),
    ).toBe('abc');

    expect([tampered('https://x/aA'), tampered('https://x/aB')]).toEqual(['https://x/aB', 'https://x/aA']);
  });
});
