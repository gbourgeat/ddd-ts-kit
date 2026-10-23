import { createHash, randomUUID } from 'node:crypto';
import { S3Error } from './s3-error';
import type { CompletedPart, ObjectPage, PendingUpload, StoredObject } from './shapes';

const MIN_PART_BYTES = 5 * 1_024 * 1_024;

/**
 * The buckets of the server and what they hold: objects by key, and the multipart uploads begun
 * and not yet completed or aborted. An object is replaced whole, never seen half written; a
 * multipart upload becomes an object only when completed with every part it names, each but the
 * last of at least 5 MiB, as S3 requires.
 */
export class ObjectStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => Date) {}

  createBucket(name: string): void {
    if (this.buckets.has(name)) {
      throw new S3Error(
        409,
        'BucketAlreadyOwnedByYou',
        'Your previous request to create the named bucket succeeded and you already own it.',
      );
    }

    this.buckets.set(name, { objects: new Map(), uploads: new Map() });
  }

  put(bucket: string, key: string, body: Buffer, contentType: string): StoredObject {
    const object = this.objectOf(body, contentType, etagOf(body));

    this.bucket(bucket).objects.set(key, object);

    return object;
  }

  get(bucket: string, key: string): StoredObject {
    const object = this.bucket(bucket).objects.get(key);

    if (object === undefined) {
      throw S3Error.noSuchKey();
    }

    return object;
  }

  copy(bucket: string, key: string, source: string): StoredObject {
    const [sourceBucket = '', ...sourceKey] = source.replace(/^\//, '').split('/');
    const original = this.get(sourceBucket, sourceKey.join('/'));
    const copy = { ...original, lastModified: this.now() };

    this.bucket(bucket).objects.set(key, copy);

    return copy;
  }

  delete(bucket: string, key: string): void {
    this.bucket(bucket).objects.delete(key);
  }

  /** Keys in the order of their bytes, from after the token, at most `maxKeys` of them. */
  list(bucket: string, prefix: string, maxKeys: number, token: string | undefined): ObjectPage {
    const after = token === undefined ? '' : Buffer.from(token, 'base64url').toString();

    const keys = [...this.bucket(bucket).objects.entries()]
      .filter(([key]) => key.startsWith(prefix) && byteOrder(key, after) > 0)
      .sort(([left], [right]) => byteOrder(left, right));

    const objects = keys.slice(0, maxKeys);
    const last = objects.at(-1)?.[0];
    const nextToken = keys.length > maxKeys && last !== undefined ? Buffer.from(last).toString('base64url') : undefined;

    return { bucket, prefix, maxKeys, token, nextToken, objects };
  }

  initiate(bucket: string, key: string, contentType: string): PendingUpload {
    const upload = { id: randomUUID(), key, contentType, parts: new Map<number, StoredObject>() };

    this.bucket(bucket).uploads.set(upload.id, upload);

    return upload;
  }

  uploadPart(bucket: string, uploadId: string, number: number, body: Buffer): StoredObject {
    if (!Number.isInteger(number) || number < 1 || number > 10_000) {
      throw new S3Error(400, 'InvalidArgument', 'Part number must be an integer between 1 and 10000, inclusive.');
    }

    const part = this.objectOf(body, '', etagOf(body));

    this.upload(bucket, uploadId).parts.set(number, part);

    return part;
  }

  complete(bucket: string, uploadId: string, named: readonly CompletedPart[]): StoredObject {
    const upload = this.upload(bucket, uploadId);
    const parts = named.map((part, index) => partOf(upload, part, index, named));
    const body = Buffer.concat(parts.map((part) => part.body));
    const digests = Buffer.concat(parts.map((part) => Buffer.from(part.etag.slice(1, -1), 'hex')));
    const object = this.objectOf(body, upload.contentType, `"${md5(digests)}-${String(parts.length)}"`);

    this.bucket(bucket).objects.set(upload.key, object);
    this.bucket(bucket).uploads.delete(uploadId);

    return object;
  }

  abort(bucket: string, uploadId: string): void {
    this.upload(bucket, uploadId);
    this.bucket(bucket).uploads.delete(uploadId);
  }

  uploads(bucket: string, prefix: string): readonly PendingUpload[] {
    return [...this.bucket(bucket).uploads.values()].filter((upload) => upload.key.startsWith(prefix));
  }

  private bucket(name: string): Bucket {
    const bucket = this.buckets.get(name);

    if (bucket === undefined) {
      throw S3Error.noSuchBucket();
    }

    return bucket;
  }

  private upload(bucket: string, uploadId: string): PendingUpload {
    const upload = this.bucket(bucket).uploads.get(uploadId);

    if (upload === undefined) {
      throw S3Error.noSuchUpload();
    }

    return upload;
  }

  private objectOf(body: Buffer, contentType: string, etag: string): StoredObject {
    return { body, contentType, etag, lastModified: this.now() };
  }
}

interface Bucket {
  readonly objects: Map<string, StoredObject>;
  readonly uploads: Map<string, PendingUpload>;
}

function partOf(
  upload: PendingUpload,
  named: CompletedPart,
  index: number,
  all: readonly CompletedPart[],
): StoredObject {
  const part = upload.parts.get(named.number);
  const previous = all[index - 1];

  if (previous !== undefined && previous.number >= named.number) {
    throw new S3Error(400, 'InvalidPartOrder', 'The list of parts was not in ascending order.');
  }

  if (part === undefined || part.etag !== named.etag) {
    throw new S3Error(400, 'InvalidPart', 'One or more of the specified parts could not be found.');
  }

  if (index < all.length - 1 && part.body.length < MIN_PART_BYTES) {
    throw new S3Error(400, 'EntityTooSmall', 'Your proposed upload is smaller than the minimum allowed object size.');
  }

  return part;
}

function byteOrder(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function etagOf(body: Buffer): string {
  return `"${md5(body)}"`;
}

function md5(data: Buffer): string {
  return createHash('md5').update(data).digest('hex');
}
