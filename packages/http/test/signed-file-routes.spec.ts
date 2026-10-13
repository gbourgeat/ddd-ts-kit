import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { executeRoute, signedFileRoutes } from '../src/index.js';
import type { RunningServer } from './support/running-server.js';
import { onExpress, onExpressFilesFirst, onFastify } from './support/upload-desk.js';

const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

describe.each([
  ['Express', onExpress],
  ['Fastify', onFastify],
])('the signed links of a served storage, on %s', (_name, start) => {
  let server: RunningServer;
  let storage: InMemoryFileStorage;

  beforeAll(async () => {
    storage = new InMemoryFileStorage({ baseUrl: 'http://placeholder/files' });
    server = await start(signedFileRoutes(storage), {});
  });

  afterAll(() => server.close());

  const onServer = (url: string) => url.replace('http://placeholder', server.url);

  it('downloads the file a link grants, as an attachment the browser must not sniff', async () => {
    await storage.put('documents/report.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    const link = await storage.signedDownloadUrl('documents/report.pdf', {
      expiresInSeconds: 60,
      fileName: 'report.pdf',
    });

    const response = await fetch(onServer(link.url));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('filename="report.pdf"');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('stores the file sent through an upload link, and refuses another media type or a larger size', async () => {
    const upload = await storage.signedUploadUrl('staging/rows.csv', {
      expiresInSeconds: 60,
      mediaType: 'text/csv',
      maxBytes: 8,
    });

    const send = (type: string) =>
      fetch(onServer(upload.url), { method: 'PUT', headers: { 'content-type': type }, body: 'a;b\n1;2\n' });

    expect((await send('text/plain')).status).toBe(403);
    expect((await send('text/csv')).status).toBe(200);
    expect((await storage.stat('staging/rows.csv'))?.size).toBe(8);

    const tooLarge = await fetch(onServer(upload.url), {
      method: 'PUT',
      headers: { 'content-type': 'text/csv' },
      body: 'a;b\n1;2\n3;4\n',
    });

    expect(tooLarge.status).toBe(413);
  });

  it('answers 403 to a forged link, or to none', async () => {
    expect((await fetch(`${server.url}/files?token=forged`)).status).toBe(403);
    expect((await fetch(`${server.url}/files?token=forged`, { method: 'PUT', body: 'x' })).status).toBe(403);
    expect((await fetch(`${server.url}/files`)).status).toBe(403);
  });
});

describe('the signed file routes on Express, mounted before the JSON parser', () => {
  it('receive a JSON file whole', async () => {
    const storage = new InMemoryFileStorage({ baseUrl: 'http://placeholder/files' });
    const server = await onExpressFilesFirst(signedFileRoutes(storage));

    const upload = await storage.signedUploadUrl('staging/data.json', {
      expiresInSeconds: 60,
      mediaType: 'application/json',
      maxBytes: 1_000,
    });

    const response = await fetch(upload.url.replace('http://placeholder', server.url), {
      method: 'PUT',
      headers: upload.headers,
      body: '{"rows":3}',
    });

    await server.close();
    expect(response.status).toBe(200);
    expect((await storage.stat('staging/data.json'))?.size).toBe(10);
  });
});

describe('the signed file routes, without a server', () => {
  it('mount under the prefix they are given, and refuse an upload whose body was already read', async () => {
    const [download, upload] = signedFileRoutes(new InMemoryFileStorage(), { prefix: '/dev/files/' });
    const consumed = Readable.from([]);

    consumed.resume();
    await new Promise((resolve) => consumed.once('end', resolve));

    expect([download?.path, upload?.path]).toEqual(['/dev/files', '/dev/files']);

    if (upload === undefined) {
      throw new Error('The upload route was expected');
    }

    const response = await executeRoute(upload, {
      params: {},
      query: { token: 'x' },
      headers: {},
      body: undefined,
      raw: undefined,
      stream: consumed,
    });

    expect(response.status).toBe(403);
  });
});
