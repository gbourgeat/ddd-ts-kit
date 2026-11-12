import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { multipartUploads } from '../src/uploads';
import { onNestExpress, onNestFastify } from './support/nest-servers';
import type { RunningServer } from './support/running-server';
import { statementRoutes } from './support/statement-desk';
import { onExpress, onFastify, onHono, uploadRoutes } from './support/upload-desk';

const latin1 = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));
/** A bank export as Windows writes it: accented letters and the euro sign as single bytes. */
const WINDOWS_1252 = latin1('Libell\xe9;Montant\r\nCaf\xe9 cr\xe8me;3,50 \x80\r\n');
const UTF_8 = new Uint8Array(Buffer.from('Libellé;Montant\r\nCafé crème;3,50 €\r\n', 'utf8'));
const UTF_16 = new Uint8Array(Buffer.from('\ufeffLibellé;Montant\r\n', 'utf16le'));
const XLS = latin1('\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1\x00\x00\x00\x00');
const PDF = latin1('%PDF-1.7\n%%EOF\n');

function form(field: string, content: Uint8Array<ArrayBuffer>, type: string): FormData {
  const data = new FormData();

  data.set('title', 'Statement of March');
  data.set(field, new Blob([content], { type }), 'statement.csv');

  return data;
}

describe.each([
  ['Express', onExpress],
  ['Fastify', onFastify],
  ['Hono', onHono],
  ['NestJS over Express', onNestExpress],
  ['NestJS over Fastify', onNestFastify],
])('a text upload that is not UTF-8, on %s', (_name, start) => {
  let server: RunningServer;

  beforeAll(async () => {
    const routes = [...uploadRoutes(new InMemoryFileStorage()), ...statementRoutes()];

    server = await start(routes, { uploads: multipartUploads() });
  });

  afterAll(() => server.close());

  const statement = (content: Uint8Array<ArrayBuffer>, type: string) =>
    fetch(`${server.url}/statements`, { method: 'POST', body: form('statement', content, type) });

  it('reaches the handler byte for byte when the route takes single-byte text, which decodes it', async () => {
    const response = await statement(WINDOWS_1252, 'text/csv');

    expect(response.status).toBe(201);

    expect(await response.json()).toEqual({
      mediaType: 'text/csv',
      size: WINDOWS_1252.length,
      utf8: false,
      firstLine: 'Libellé;Montant',
    });
  });

  it('is taken under the name a browser on Windows gives a CSV, and so is the same file in UTF-8', async () => {
    const windows = await statement(WINDOWS_1252, 'application/vnd.ms-excel');
    const utf8 = await statement(UTF_8, 'text/csv; charset=utf-8');

    expect([windows.status, utf8.status]).toEqual([201, 201]);
    expect(await windows.json()).toMatchObject({ mediaType: 'application/vnd.ms-excel', utf8: false });
    expect(await utf8.json()).toMatchObject({ mediaType: 'text/csv', utf8: true, firstLine: 'Libellé;Montant' });
  });

  it('is refused with 415 when it is a binary file under the name of a CSV, or UTF-16', async () => {
    const refused = await Promise.all([
      statement(XLS, 'text/csv'),
      statement(XLS, 'application/vnd.ms-excel'),
      statement(PDF, 'text/csv'),
      statement(UTF_16, 'text/csv'),
      statement(WINDOWS_1252, 'text/plain'),
    ]);

    expect(refused.map((response) => response.status)).toEqual([415, 415, 415, 415, 415]);
  });

  it('is taken as it is under a type the route states as unchecked', async () => {
    const response = await statement(XLS, 'application/octet-stream');

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ mediaType: 'application/octet-stream', size: XLS.length });
  });

  it('is refused with 415 by a route that does not say it takes single-byte text', async () => {
    const body = form('document', WINDOWS_1252, 'text/plain');
    const response = await fetch(`${server.url}/documents`, { method: 'POST', body });

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });
});
