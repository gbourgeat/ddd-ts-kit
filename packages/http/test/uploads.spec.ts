import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { executeRoute, type Route } from '../src';
import { multipartUploads } from '../src/uploads';
import type { RunningServer } from './support/running-server';
import { onExpress, onFastify, onHono, uploadRoutes } from './support/upload-desk';

const PDF = '%PDF-1.7\n%%EOF\n';

function form(content: string, type: string, title = 'Referral letter'): FormData {
  const data = new FormData();

  data.set('title', title);
  data.set('document', new Blob([content], { type }), 'referral.pdf');

  return data;
}

async function codeOf(response: Response): Promise<[number, unknown]> {
  const problem: unknown = await response.json();

  return [
    response.status,
    typeof problem === 'object' && problem !== null && 'code' in problem ? problem.code : undefined,
  ];
}

describe.each([
  ['Express', onExpress],
  ['Fastify', onFastify],
  ['Hono', onHono],
])('a controller that declares an upload, on %s', (_name, start) => {
  let server: RunningServer;
  let storage: InMemoryFileStorage;

  beforeAll(async () => {
    storage = new InMemoryFileStorage();
    server = await start(uploadRoutes(storage), { uploads: multipartUploads() });
  });

  afterAll(() => server.close());

  const post = (body: FormData | string, headers: Record<string, string> = {}) =>
    fetch(`${server.url}/documents`, { method: 'POST', body, headers });

  it('streams the file to the handler, with the text fields sent before it as the body', async () => {
    const response = await post(form(PDF, 'application/pdf'));

    expect(response.status).toBe(201);

    expect(await response.json()).toEqual({
      title: 'Referral letter',
      fileName: 'referral.pdf',
      size: PDF.length,
      mediaType: 'application/pdf',
    });
  });

  it('refuses a file larger than declared with 413, and leaves nothing stored', async () => {
    const before = storage.keys().length;

    expect(await codeOf(await post(form(`${PDF}${'x'.repeat(80)}`, 'application/pdf')))).toEqual([
      413,
      'FILE_TOO_LARGE',
    ]);

    expect(storage.keys().length).toBeLessThanOrEqual(before);
  });

  it('refuses with 415 a content that is not what it declares, or a type not accepted', async () => {
    expect(await codeOf(await post(form('\x89PNG\r\n\x1a\n', 'application/pdf')))).toEqual([
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ]);

    expect(await codeOf(await post(form('<svg/>', 'image/svg+xml')))).toEqual([415, 'UNSUPPORTED_MEDIA_TYPE']);
  });

  it('accepts a type of an accepted family, checked on the content', async () => {
    expect((await post(form('plain notes\n', 'text/plain'))).status).toBe(201);
  });

  it('answers 422 for a form without the file, and for text fields the body schema refuses', async () => {
    const withoutFile = new FormData();

    withoutFile.set('title', 'Referral letter');

    expect(await codeOf(await post(withoutFile))).toEqual([422, 'VALIDATION_FAILED']);
    expect(await codeOf(await post(form(PDF, 'application/pdf', '')))).toEqual([422, 'VALIDATION_FAILED']);
  });

  it('answers 415 for a body that is not a multipart form', async () => {
    const json = await post(JSON.stringify({ title: 'x' }), { 'content-type': 'application/json' });

    expect(await codeOf(json)).toEqual([415, 'UNSUPPORTED_MEDIA_TYPE']);
  });
});

describe('reading an upload, without a server', () => {
  const route = (): Route => {
    const [attach] = uploadRoutes(new InMemoryFileStorage());

    if (attach === undefined) {
      throw new Error('The upload route was expected');
    }

    return attach;
  };

  it('refuses a request that announces a body far larger than the file allowed, before reading it', async () => {
    const headers = { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(10_000_000) };

    const response = await executeRoute(
      route(),
      { params: {}, query: {}, headers, body: undefined, raw: undefined },
      { uploads: multipartUploads() },
    );

    expect([response.status, (response.body as { code: string }).code]).toEqual([413, 'FILE_TOO_LARGE']);
  });

  it('fails as a defect when the routes are mounted without an upload reader, or the adapter gives no stream', async () => {
    const headers = { 'content-type': 'multipart/form-data; boundary=x' };
    const request = { params: {}, query: {}, headers, body: undefined, raw: undefined };

    expect((await executeRoute(route(), request)).status).toBe(500);
    expect((await executeRoute(route(), request, { uploads: multipartUploads() })).status).toBe(500);
  });
});
