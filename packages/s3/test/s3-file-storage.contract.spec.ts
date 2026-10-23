import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { ListMultipartUploadsCommand } from '@aws-sdk/client-s3';
import { FileError } from '@ddd-ts-kit/kernel';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { S3FileStorage } from '../src';
import { fileStorageContract } from '../src/testing';
import { BUCKET, SERVERS, type S3Server, aPrefix } from './support/servers';

const runner = { describe, it, expect, beforeEach };
const MEBIBYTE = 1_048_576;

async function* mebibytes(count: number): AsyncIterable<Uint8Array> {
  for (let part = 0; part < count; part += 1) {
    yield new Uint8Array(MEBIBYTE).fill(part);
  }
}

async function digestOf(stream: AsyncIterable<Uint8Array>): Promise<string> {
  const hash = createHash('sha256');

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

describe.each(SERVERS)('S3FileStorage, %s', (name, start) => {
  let server: S3Server;

  beforeAll(async () => {
    server = await start();
  });

  afterAll(async () => {
    await server.stop();
  });

  const storageOf = (prefix = aPrefix(), partSize?: number, client = server.client): S3FileStorage =>
    new S3FileStorage({ client, bucket: BUCKET, prefix, ...(partSize === undefined ? {} : { partSize }) });

  fileStorageContract(runner, {
    name: `S3FileStorage ${name}`,
    createStorage: () => storageOf(),
    elapse: (ms) => server.elapse(ms),
  });

  it('keeps the files of two prefixes apart in one bucket', async () => {
    const [left, right] = [storageOf(), storageOf()];

    await left.put('documents/a.pdf', Readable.from([Buffer.from('%PDF-')]), { mediaType: 'application/pdf' });

    expect(await right.stat('documents/a.pdf')).toBeUndefined();
    expect((await left.stat('documents/a.pdf'))?.size).toBe(5);
  });

  it('stores a content larger than one part in parts, and gives it back whole', async () => {
    const storage = storageOf(aPrefix(), 5 * MEBIBYTE);

    const stored = await storage.put('exports/large.bin', mebibytes(12), { mediaType: 'application/octet-stream' });
    const content = await storage.get('exports/large.bin');

    expect(stored.size).toBe(12 * MEBIBYTE);
    expect(content?.metadata.size).toBe(12 * MEBIBYTE);
    expect(await digestOf(content?.stream ?? Readable.from([]))).toBe(await digestOf(mebibytes(12)));
  });

  it('aborts a multipart upload refused on its way, leaving no part behind', async () => {
    const prefix = aPrefix();
    const storage = storageOf(prefix, 5 * MEBIBYTE);

    const refusal = await storage
      .put('exports/large.bin', mebibytes(12), { mediaType: 'application/octet-stream', maxBytes: 11 * MEBIBYTE })
      .catch((error: unknown) => error);

    const pending = await server.client.send(new ListMultipartUploadsCommand({ Bucket: BUCKET, Prefix: prefix }));

    expect(FileError.is(refusal, 'FILE_TOO_LARGE')).toBe(true);
    expect(pending.Uploads ?? []).toEqual([]);
    expect(await storage.stat('exports/large.bin')).toBeUndefined();
  });

  it('lists every file under a prefix, however many pages the server answers them in', async () => {
    const storage = storageOf();
    const keys = ['inbox/a.txt', 'inbox/b.txt', 'inbox/c.txt', 'inbox/d/e.txt', 'inbox/f.txt'];

    for (const key of keys) {
      await storage.put(key, Readable.from([Buffer.from(key)]), { mediaType: 'text/plain' });
    }

    const listed: string[] = [];

    for await (const file of storage.list('inbox/')) {
      listed.push(file.key);
    }

    expect(listed.sort()).toEqual(keys);
  });

  it('moves a file onto its own key, keeping it, and refuses to when it is not there', async () => {
    const storage = storageOf();

    await storage.put('documents/a.pdf', Readable.from([Buffer.from('%PDF-')]), { mediaType: 'application/pdf' });
    await storage.move('documents/a.pdf', 'documents/a.pdf');

    const refusal = await storage.move('documents/b.pdf', 'documents/b.pdf').catch((error: unknown) => error);

    expect((await storage.stat('documents/a.pdf'))?.size).toBe(5);
    expect(FileError.is(refusal, 'FILE_NOT_FOUND')).toBe(true);
  });

  it('fails, rather than answering that nothing is there, when the server refuses the request', async () => {
    const prefix = aPrefix();
    const storage = storageOf(prefix);
    const stranger = storageOf(prefix, undefined, server.stranger);

    await storage.put('documents/a.pdf', Readable.from([Buffer.from('%PDF-')]), { mediaType: 'application/pdf' });

    const refusals = await Promise.all(
      [
        stranger.stat('documents/a.pdf'),
        stranger.get('documents/a.pdf'),
        stranger.copy('documents/a.pdf', 'documents/b.pdf'),
      ].map((work) =>
        work.then(
          () => 'answered',
          (error: unknown) => (FileError.is(error) ? error.code : 'refused'),
        ),
      ),
    );

    expect(refusals).toEqual(['refused', 'refused', 'refused']);
  });
});
