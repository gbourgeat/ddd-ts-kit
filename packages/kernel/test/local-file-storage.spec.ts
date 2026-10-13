import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFileStorage } from '../src/index.js';

const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

let directory: string;

async function keysOf(storage: LocalFileStorage): Promise<string[]> {
  const keys: string[] = [];

  for await (const file of storage.list('')) {
    keys.push(file.key);
  }

  return keys;
}

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
