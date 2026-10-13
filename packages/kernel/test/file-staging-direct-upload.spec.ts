import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  FileError,
  FileStaging,
  InMemoryErrorReporter,
  InMemoryFileStorage,
  stagedKeyOf,
  type PendingUpload,
} from '../src/index.js';

const PDF = new Uint8Array(Buffer.from('%PDF-1.7\n%%EOF\n'));
const KEY = 'appointment-documents/2026/03/doc-1';
const GRANT = { expiresInSeconds: 300, mediaType: 'application/pdf', accepted: ['application/pdf'], maxBytes: 1_000 };

function aDesk() {
  const storage = new InMemoryFileStorage();

  return {
    storage,
    staging: new FileStaging(storage, { scan: async () => ({ accepted: true }) }, new InMemoryErrorReporter()),
  };
}

const codeOf = (work: Promise<unknown>) =>
  work.then(
    () => 'resolved',
    (error: unknown) => (FileError.is(error) ? error.code : String(error)),
  );

const tokenOf = (url: string) => new URL(url).searchParams.get('token') ?? '';

describe('FileStaging, for a file sent straight to the storage', () => {
  it('signs a link for the client and answers the grant the server keeps: key, cap and media types', async () => {
    const { staging } = aDesk();

    const { link, pending } = await staging.uploadUrl(KEY, GRANT);

    expect(link).toMatchObject({ method: 'PUT', headers: { 'content-type': 'application/pdf' } });
    expect(pending).toEqual({ key: KEY, mediaType: 'application/pdf', accepted: ['application/pdf'], maxBytes: 1_000 });
  });

  it('confirms a file uploaded through its link: measured, checked on its bytes, still staged', async () => {
    const { staging, storage } = aDesk();
    const { link, pending } = await staging.uploadUrl(KEY, GRANT);

    await storage.acceptSigned(tokenOf(link.url), Readable.from([PDF]), 'application/pdf');

    const file = await staging.confirm(pending);

    expect(file).toMatchObject({ key: KEY, size: PDF.length, mediaType: 'application/pdf' });
    expect(file.checksum).toMatch(/^sha256:/);
    expect(storage.keys()).toEqual([stagedKeyOf(KEY)]);
  });

  it('refuses through the link itself an upload larger than the grant, on a storage the application serves', async () => {
    const { staging, storage } = aDesk();
    const { link } = await staging.uploadUrl(KEY, { ...GRANT, maxBytes: 4 });

    expect(await codeOf(storage.acceptSigned(tokenOf(link.url), Readable.from([PDF]), 'application/pdf'))).toBe(
      'FILE_TOO_LARGE',
    );

    expect(storage.keys()).toEqual([]);
  });

  it('discards an uploaded file that is not what it declared, or larger than its grant, and refuses a missing one', async () => {
    const { staging, storage } = aDesk();

    const pending: PendingUpload = {
      key: KEY,
      mediaType: 'application/pdf',
      accepted: ['application/pdf'],
      maxBytes: 1_000,
    };

    await storage.put(stagedKeyOf(KEY), Readable.from([Buffer.from('<html>')]), { mediaType: 'application/pdf' });
    expect(await codeOf(staging.confirm(pending))).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(storage.keys()).toEqual([]);

    await storage.put(stagedKeyOf(KEY), Readable.from([PDF]), { mediaType: 'application/pdf' });
    expect(await codeOf(staging.confirm({ ...pending, maxBytes: 4 }))).toBe('FILE_TOO_LARGE');
    expect(await codeOf(staging.confirm(pending))).toBe('FILE_NOT_FOUND');
  });

  it('reaches only the key of the grant it is given: what a client sent under another key, or a key it made up, is not confirmed', async () => {
    const { staging, storage } = aDesk();
    const granted = await staging.uploadUrl(KEY, GRANT);
    const other = await staging.uploadUrl('appointment-documents/2026/03/doc-2', GRANT);

    await storage.acceptSigned(tokenOf(other.link.url), Readable.from([PDF]), 'application/pdf');

    expect(await codeOf(staging.confirm(granted.pending))).toBe('FILE_NOT_FOUND');
    expect(await codeOf(staging.confirm({ ...granted.pending, key: '../outside' }))).toBe('INVALID_FILE_KEY');
    expect(await codeOf(staging.confirm({ ...granted.pending, key: stagedKeyOf(KEY) }))).toBe('INVALID_FILE_KEY');
  });
});
