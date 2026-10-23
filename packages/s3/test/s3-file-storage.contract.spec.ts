import { Readable } from 'node:stream';
import { ListMultipartUploadsCommand, type S3Client } from '@aws-sdk/client-s3';
import { FileError } from '@ddd-ts-kit/kernel';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { S3FileStorage } from '../src';
import { fileStorageContract } from '../src/testing';
import { BUCKET, REAL_SERVER, aPrefix, connect, ensureBucket, sleep } from './support/server';

const runner = { describe, it, expect, beforeEach };

async function* tooLarge(): AsyncIterable<Uint8Array> {
  for (let part = 0; part < 12; part += 1) {
    yield new Uint8Array(1_048_576).fill(part);
  }
}

describe.skipIf(!REAL_SERVER)('S3FileStorage on a server', () => {
  let client: S3Client;

  beforeAll(async () => {
    client = connect();
    await ensureBucket(client);
  });

  fileStorageContract(runner, {
    name: 'S3FileStorage',
    createStorage: () => new S3FileStorage({ client, bucket: BUCKET, prefix: aPrefix() }),
    elapse: sleep,
  });

  it('keeps the files of two prefixes apart in one bucket', async () => {
    const [left, right] = [aPrefix(), aPrefix()].map((prefix) => new S3FileStorage({ client, bucket: BUCKET, prefix }));

    await left?.put('documents/a.pdf', Readable.from([Buffer.from('%PDF-')]), { mediaType: 'application/pdf' });

    expect(await right?.stat('documents/a.pdf')).toBeUndefined();
    expect((await left?.stat('documents/a.pdf'))?.size).toBe(5);
  });

  it('aborts a multipart upload refused on its way, leaving no part behind', async () => {
    const prefix = aPrefix();
    const storage = new S3FileStorage({ client, bucket: BUCKET, prefix, partSize: 5 * 1_048_576 });

    const refusal = await storage
      .put('exports/large.bin', tooLarge(), { mediaType: 'application/octet-stream', maxBytes: 11 * 1_048_576 })
      .catch((error: unknown) => error);

    const pending = await client.send(new ListMultipartUploadsCommand({ Bucket: BUCKET, Prefix: prefix }));

    expect(FileError.is(refusal, 'FILE_TOO_LARGE')).toBe(true);
    expect(pending.Uploads ?? []).toEqual([]);
    expect(await storage.stat('exports/large.bin')).toBeUndefined();
  });
});
