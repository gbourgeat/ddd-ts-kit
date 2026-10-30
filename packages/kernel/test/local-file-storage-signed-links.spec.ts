import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileError, FixedClock, LocalFileStorage, type FileContent } from '../src';

const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

let directory: string;

async function keysOf(storage: LocalFileStorage): Promise<string[]> {
  const keys: string[] = [];

  for await (const file of storage.list('')) {
    keys.push(file.key);
  }

  return keys;
}

const codeOf = (work: Promise<unknown>) =>
  work.then(
    () => 'resolved',
    (error: unknown) => (FileError.is(error) ? error.code : String(error)),
  );

const tokenOf = (url: string) => new URL(url).searchParams.get('token') ?? '';

const contentOf = async (file: FileContent | undefined) => (file === undefined ? undefined : text(file.stream));

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-ts-kit-local-'));
});

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

const NOW = new Date('2026-10-18T09:00:00.000Z');
const SECRET = 'a secret of the deployment';

const aStorage = (clock = new FixedClock(NOW)) =>
  new LocalFileStorage({ directory, secret: SECRET, clock, baseUrl: 'https://clinic.example/files//' });

/** A token signed with the secret of the storage, for a grant written by hand. */
const forged = (payload: string) => `${payload}.${createHmac('sha256', SECRET).update(payload).digest('base64url')}`;
const grantOf = (grant: object) => Buffer.from(JSON.stringify(grant)).toString('base64url');
const expiresAt = NOW.getTime() / 1_000 + 300;

describe('LocalFileStorage, the download links it signs itself', () => {
  it('signs a download link under its base url, which opens the file until it expires', async () => {
    const clock = new FixedClock(NOW);
    const storage = aStorage(clock);

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    const link = await storage.signedDownloadUrl('documents/a.pdf', { expiresInSeconds: 300 });
    const download = await storage.openSigned(tokenOf(link.url));

    expect(link.url.startsWith('https://clinic.example/files?token=')).toBe(true);
    expect(link.expiresAt).toEqual(new Date('2026-10-18T09:05:00.000Z'));
    expect(download?.metadata.key).toBe('documents/a.pdf');
    expect(download?.fileName).toBeUndefined();
    expect(await contentOf(download)).toBe(PDF.toString());

    clock.advance(300_000);

    expect(await storage.openSigned(tokenOf(link.url))).toBeUndefined();
  });

  it('rejects the link it is asked for a key or an expiry it refuses, instead of throwing at the call', async () => {
    const storage = aStorage();

    expect(await codeOf(storage.signedDownloadUrl('../a.pdf', { expiresInSeconds: 60 }))).toBe('INVALID_FILE_KEY');

    expect(await codeOf(storage.signedDownloadUrl('documents/a.pdf', { expiresInSeconds: 0 }))).toBe(
      'INVALID_FILE_URL_EXPIRY',
    );

    expect(
      await codeOf(
        storage.signedUploadUrl('../a.pdf', { expiresInSeconds: 60, mediaType: 'application/pdf', maxBytes: 1_000 }),
      ),
    ).toBe('INVALID_FILE_KEY');

    expect(
      await codeOf(
        storage.signedUploadUrl('uploads/a.pdf', {
          expiresInSeconds: 0,
          mediaType: 'application/pdf',
          maxBytes: 1_000,
        }),
      ),
    ).toBe('INVALID_FILE_URL_EXPIRY');
  });

  it('offers the name it was signed with, and opens nothing for a key that holds no file', async () => {
    const storage = aStorage();

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    const named = await storage.signedDownloadUrl('documents/a.pdf', { expiresInSeconds: 60, fileName: 'scan.pdf' });
    const missing = await storage.signedDownloadUrl('documents/b.pdf', { expiresInSeconds: 60, fileName: 'b.pdf' });

    const download = await storage.openSigned(tokenOf(named.url));

    expect(download?.fileName).toBe('scan.pdf');
    expect(await contentOf(download)).toBe(PDF.toString());
    expect(await storage.openSigned(tokenOf(missing.url))).toBeUndefined();
  });

  it('opens nothing for a token changed by a byte, signed by another storage, or granted for another action', async () => {
    const storage = aStorage();
    const stranger = new LocalFileStorage({ directory });

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    const token = tokenOf((await storage.signedDownloadUrl('documents/a.pdf', { expiresInSeconds: 60 })).url);

    const upload = tokenOf(
      (
        await storage.signedUploadUrl('documents/a.pdf', {
          expiresInSeconds: 60,
          mediaType: 'application/pdf',
          maxBytes: 99,
        })
      ).url,
    );

    const changed = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

    expect(await storage.openSigned(changed)).toBeUndefined();
    expect(await storage.openSigned('no-dot-at-all')).toBeUndefined();
    expect(await storage.openSigned(upload)).toBeUndefined();
    expect(await stranger.openSigned(token)).toBeUndefined();
  });

  it('opens nothing for a token signed with its secret whose grant it cannot read', async () => {
    const storage = aStorage();

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    expect(await storage.openSigned(forged(Buffer.from('not json').toString('base64url')))).toBeUndefined();
    expect(await storage.openSigned(forged(Buffer.from('42').toString('base64url')))).toBeUndefined();

    expect(await storage.openSigned(forged(grantOf({ action: 'delete', key: 'documents/a.pdf', expiresAt })))).toBe(
      undefined,
    );

    expect(
      await contentOf(
        await storage.openSigned(forged(grantOf({ action: 'download', key: 'documents/a.pdf', expiresAt }))),
      ),
    ).toBe(PDF.toString());
  });
});

describe('LocalFileStorage, the upload links it signs itself', () => {
  it('signs an upload link for one media type, and stores what it is sent in that type only', async () => {
    const storage = aStorage();

    const link = await storage.signedUploadUrl('uploads/scan.pdf', {
      expiresInSeconds: 120,
      mediaType: 'Application/PDF',
      maxBytes: 1_000,
    });

    expect(link).toMatchObject({ method: 'PUT', headers: { 'content-type': 'application/pdf' } });
    expect(await storage.acceptSigned(tokenOf(link.url), Readable.from([PDF]), 'image/png')).toBeUndefined();
    expect(await storage.stat('uploads/scan.pdf')).toBeUndefined();

    const stored = await storage.acceptSigned(tokenOf(link.url), Readable.from([PDF]), 'application/pdf');

    expect(stored).toMatchObject({ key: 'uploads/scan.pdf', size: PDF.length, mediaType: 'application/pdf' });
  });

  it('refuses beyond the size an upload link was signed for, and takes any size from a grant that names none', async () => {
    const storage = aStorage();
    const large = Buffer.alloc(2_000, 65);

    const capped = await storage.signedUploadUrl('uploads/a.txt', {
      expiresInSeconds: 120,
      mediaType: 'text/plain',
      maxBytes: 10,
    });

    const uncapped = forged(grantOf({ action: 'upload', key: 'uploads/b.txt', mediaType: 'text/plain', expiresAt }));
    const untyped = forged(grantOf({ action: 'upload', key: 'uploads/c.txt', expiresAt }));

    expect(await codeOf(storage.acceptSigned(tokenOf(capped.url), Readable.from([large]), 'text/plain'))).toBe(
      'FILE_TOO_LARGE',
    );

    expect(await storage.acceptSigned(uncapped, Readable.from([large]), 'text/plain')).toMatchObject({ size: 2_000 });
    expect(await storage.acceptSigned(untyped, Readable.from([large]), 'text/plain')).toBeUndefined();
    expect(await keysOf(storage)).toEqual(['uploads/b.txt']);
  });

  it('signs under the default address with a secret of its own when given none', async () => {
    const storage = new LocalFileStorage({ directory });
    const other = new LocalFileStorage({ directory });

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    const link = await storage.signedDownloadUrl('documents/a.pdf', { expiresInSeconds: 60 });

    expect(link.url.startsWith('http://localhost:3000/files?token=')).toBe(true);
    expect(await other.openSigned(tokenOf(link.url))).toBeUndefined();
  });
});
