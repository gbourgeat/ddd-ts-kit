import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileError, LocalFileStorage, type FileContent } from '../src';

const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

let directory: string;

async function keysOf(storage: LocalFileStorage): Promise<string[]> {
  const keys: string[] = [];

  for await (const file of storage.list('')) {
    keys.push(file.key);
  }

  return keys;
}

async function listed(storage: LocalFileStorage, prefix: string): Promise<string[]> {
  const keys: string[] = [];

  for await (const file of storage.list(prefix)) {
    keys.push(file.key);
  }

  return keys.sort();
}

const codeOf = (work: Promise<unknown>) =>
  work.then(
    () => 'resolved',
    (error: unknown) => (FileError.is(error) ? error.code : String(error)),
  );

const contentOf = async (file: FileContent | undefined) => (file === undefined ? undefined : text(file.stream));

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-ts-kit-local-'));
});

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

describe('LocalFileStorage', () => {
  it('keeps each file under its key, its metadata aside, and nothing of a refused write', async () => {
    const storage = new LocalFileStorage({ directory });

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    await storage
      .put('documents/b.pdf', Readable.from([PDF]), { mediaType: 'application/pdf', maxBytes: 2 })
      .catch(() => undefined);

    expect(await fs.readFile(path.join(directory, 'documents', 'a.pdf'))).toEqual(PDF);
    expect(await fs.readdir(path.join(directory, '.incoming'))).toEqual([]);

    expect(
      JSON.parse(await fs.readFile(path.join(directory, '.metadata', 'documents', 'a.pdf.json'), 'utf8')),
    ).toMatchObject({
      mediaType: 'application/pdf',
    });
  });

  it('reads a file placed by hand as bytes of no known type, and lists nothing in a directory not created yet', async () => {
    const storage = new LocalFileStorage({ directory: path.join(directory, 'later') });

    expect(await keysOf(storage)).toEqual([]);

    await fs.mkdir(path.join(directory, 'later', 'imports'), { recursive: true });
    await fs.writeFile(path.join(directory, 'later', 'imports', 'by-hand.csv'), 'a;b\n');

    expect(await storage.stat('imports/by-hand.csv')).toMatchObject({ size: 4, mediaType: 'application/octet-stream' });
    expect((await storage.stat('imports/by-hand.csv'))?.checksum).toBeUndefined();
    expect(await keysOf(storage)).toEqual(['imports/by-hand.csv']);
  });

  it('answers undefined for a directory under a key, which is no file', async () => {
    const storage = new LocalFileStorage({ directory });

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    expect(await storage.stat('documents')).toBeUndefined();
  });
});

describe('LocalFileStorage, a file through its life', () => {
  it('reads back what it stored, with its size, its media type and its checksum', async () => {
    const storage = new LocalFileStorage({ directory });

    const stored = await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'Application/PDF' });
    const file = await storage.get('documents/a.pdf');

    expect(stored).toEqual({
      key: 'documents/a.pdf',
      size: PDF.length,
      mediaType: 'application/pdf',
      checksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });

    expect(file?.metadata).toMatchObject({ key: 'documents/a.pdf', size: PDF.length, mediaType: 'application/pdf' });
    expect(file?.metadata.checksum).toBe(stored.checksum);
    expect(await contentOf(file)).toBe(PDF.toString());
    expect(await storage.get('documents/missing.pdf')).toBeUndefined();
  });

  it('deletes a file with its metadata, and a key that holds nothing without complaint', async () => {
    const storage = new LocalFileStorage({ directory });

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });
    await storage.delete('documents/a.pdf');
    await storage.delete('documents/never-stored.pdf');

    expect(await storage.stat('documents/a.pdf')).toBeUndefined();
    expect(await fs.readdir(path.join(directory, '.metadata', 'documents'))).toEqual([]);
  });

  it('copies a file under another key, both keeping the media type and the checksum', async () => {
    const storage = new LocalFileStorage({ directory });
    const stored = await storage.put('inbox/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });

    await storage.copy('inbox/a.pdf', 'archive/2026/a.pdf');

    expect(await storage.stat('inbox/a.pdf')).toMatchObject({ mediaType: 'application/pdf' });

    expect(await storage.stat('archive/2026/a.pdf')).toMatchObject({
      size: PDF.length,
      mediaType: 'application/pdf',
      checksum: stored.checksum,
    });

    expect(await contentOf(await storage.get('archive/2026/a.pdf'))).toBe(PDF.toString());
  });

  it('moves a file under another key, leaving nothing under the first, and keeps it when moved onto itself', async () => {
    const storage = new LocalFileStorage({ directory });

    await storage.put('inbox/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });
    await storage.move('inbox/a.pdf', 'archive/a.pdf');
    await storage.move('archive/a.pdf', 'archive/a.pdf');

    expect(await storage.stat('inbox/a.pdf')).toBeUndefined();
    expect(await fs.readdir(path.join(directory, '.metadata', 'inbox'))).toEqual([]);
    expect(await storage.stat('archive/a.pdf')).toMatchObject({ size: PDF.length, mediaType: 'application/pdf' });
  });

  it('refuses to copy or move a key that holds no file', async () => {
    const storage = new LocalFileStorage({ directory });

    expect(await codeOf(storage.copy('inbox/missing.pdf', 'archive/a.pdf'))).toBe('FILE_NOT_FOUND');
    expect(await codeOf(storage.move('inbox/missing.pdf', 'archive/a.pdf'))).toBe('FILE_NOT_FOUND');
    expect(await keysOf(storage)).toEqual([]);
  });

  it('lists the files under a prefix only, never what it keeps for itself', async () => {
    const storage = new LocalFileStorage({ directory });

    await storage.put('invoices/2026/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });
    await storage.put('invoices/2025/b.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });
    await storage.put('avatars/c.png', Readable.from([PDF]), { mediaType: 'image/png' });

    expect(await listed(storage, 'invoices/')).toEqual(['invoices/2025/b.pdf', 'invoices/2026/a.pdf']);
    expect(await listed(storage, '')).toHaveLength(3);
  });

  it('takes metadata it cannot read for bytes of no known type', async () => {
    const storage = new LocalFileStorage({ directory });

    await storage.put('documents/a.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });
    await storage.put('documents/b.pdf', Readable.from([PDF]), { mediaType: 'application/pdf' });
    await fs.writeFile(path.join(directory, '.metadata', 'documents', 'a.pdf.json'), 'null');
    await fs.writeFile(path.join(directory, '.metadata', 'documents', 'b.pdf.json'), '{"mediaType":3,"checksum":""}');

    for (const key of ['documents/a.pdf', 'documents/b.pdf']) {
      const metadata = await storage.stat(key);

      expect(metadata?.mediaType).toBe('application/octet-stream');
      expect(metadata?.checksum).toBeUndefined();
    }
  });
});
