import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { Representations, signedFileRoutes } from '../src/index.js';
import { multipartUploads } from '../src/uploads.js';
import type { RunningServer } from './support/running-server.js';
import { onExpress, onFastify, uploadRoutes } from './support/upload-desk.js';

const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

describe.each([
  ['Express', onExpress],
  ['Fastify', onFastify],
])('files, when the platform negotiates representations, on %s', (_name, start) => {
  let server: RunningServer;
  let storage: InMemoryFileStorage;

  beforeAll(async () => {
    storage = new InMemoryFileStorage({ baseUrl: 'http://placeholder/files' });
    const routes = [...signedFileRoutes(storage), ...uploadRoutes(storage)];

    server = await start(routes, { representations: Representations.standard(), uploads: multipartUploads() });
  });

  afterAll(() => server.close());

  const downloadLink = async (): Promise<string> => {
    await storage.put('documents/report.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });
    const link = await storage.signedDownloadUrl('documents/report.pdf', { expiresInSeconds: 60 });

    return link.url.replace('http://placeholder', server.url);
  };

  it.each(['application/pdf', '*/*', 'application/json'])(
    'downloads the bytes of a file whole, under its own type, for Accept %s',
    async (accept) => {
      const response = await fetch(await downloadLink(), { headers: { accept } });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF);
    },
  );

  it('refuses a forged link with a JSON problem, the only type the route answers in', async () => {
    const response = await fetch(`${server.url}/files?token=forged`, { headers: { accept: 'application/xml' } });

    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
  });

  it('stores the file sent through an upload link, whatever the request accepts', async () => {
    const upload = await storage.signedUploadUrl('staging/scan.png', {
      expiresInSeconds: 60,
      mediaType: 'image/png',
      maxBytes: 64,
    });

    const response = await fetch(upload.url.replace('http://placeholder', server.url), {
      method: 'PUT',
      headers: { 'content-type': 'image/png', accept: 'image/png' },
      body: new Uint8Array([137, 80, 78, 71]),
    });

    expect(response.status).toBe(200);
    expect((await storage.stat('staging/scan.png'))?.size).toBe(4);
  });

  it('receives a multipart upload and answers it in the representation negotiated', async () => {
    const data = new FormData();

    data.set('title', 'Referral letter');
    data.set('document', new Blob([PDF], { type: 'application/pdf' }), 'referral.pdf');

    const response = await fetch(`${server.url}/documents`, { method: 'POST', body: data });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ fileName: 'referral.pdf', size: PDF.length });
  });
});
