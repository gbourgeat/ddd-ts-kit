import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  FileError,
  FileInspection,
  FileStorage,
  SystemClock,
  assertExpiry,
  contentDisposition,
  mediaTypeOf,
  type Clock,
  type DownloadUrlOptions,
  type FileContent,
  type FileMetadata,
  type FileSource,
  type ListedFile,
  type PutOptions,
  type SignedUpload,
  type SignedUrl,
  type StoredFile,
  type UploadUrlOptions,
} from '@ddd-ts-kit/kernel';
import { BucketKeys } from './bucket-keys';
import { isMissing } from './is-missing';
import { listObjects } from './list-objects';
import type { S3FileStorageOptions } from './s3-file-storage-options';
import { settledFirst } from './settled-first';

const MEBIBYTE = 1_024 * 1_024;

/**
 * The `FileStorage` of a deployment: one bucket of any provider of the S3 protocol. An upload
 * streams in parts of `partSize`, so at most one part is held in memory; a content refused on
 * its way (`FILE_TOO_LARGE`) aborts the upload and leaves the previous object. The checksum is
 * computed while the content streams and answered by `put`, not kept by the bucket: `stat` does
 * not know it. Copy and move are done by the service, up to 5 GiB per object.
 */
export class S3FileStorage extends FileStorage {
  private readonly client: S3Client;

  private readonly bucket: string;

  private readonly keys: BucketKeys;

  private readonly partSize: number;

  private readonly clock: Clock;

  constructor(options: S3FileStorageOptions) {
    super();
    this.client = options.client;
    this.bucket = options.bucket;
    this.keys = new BucketKeys(options.prefix ?? '');
    this.partSize = Math.max(5 * MEBIBYTE, options.partSize ?? 8 * MEBIBYTE);
    this.clock = options.clock ?? new SystemClock();
  }

  async put(key: string, content: FileSource, options: PutOptions): Promise<StoredFile> {
    const objectKey = this.keys.of(key);
    const mediaType = mediaTypeOf(options.mediaType);
    const inspection = new FileInspection(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes });

    // The SDK reads a `size` on the body as its whole length, and the inspection counts in its own
    // the bytes read so far: handed as it is, a content of several parts was refused once sent.
    const body = Readable.from(inspection, { objectMode: false });

    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: objectKey, Body: body, ContentType: mediaType },
      partSize: this.partSize,
      queueSize: 1,
      leavePartsOnError: false,
    });

    await settledFirst(pipeline(content, inspection), upload.done());

    return { key, size: inspection.size, mediaType, checksum: inspection.checksum };
  }

  async get(key: string): Promise<FileContent | undefined> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.keys.of(key) });
    const response = await this.client.send(command).catch(absentAsUndefined);

    if (response === undefined) {
      return undefined;
    }

    if (!(response.Body instanceof Readable)) {
      throw new Error('The S3 client answered a body that is not a Node.js stream: use the Node.js build of the SDK.');
    }

    return { metadata: metadataOf(key, response), stream: response.Body };
  }

  async stat(key: string): Promise<FileMetadata | undefined> {
    const command = new HeadObjectCommand({ Bucket: this.bucket, Key: this.keys.of(key) });
    const response = await this.client.send(command).catch(absentAsUndefined);

    return response === undefined ? undefined : metadataOf(key, response);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.keys.of(key) }));
  }

  async copy(from: string, to: string): Promise<void> {
    const source = `${this.bucket}/${this.keys.of(from)}`;
    const command = new CopyObjectCommand({ Bucket: this.bucket, Key: this.keys.of(to), CopySource: source });

    await this.client.send(command).catch((error: unknown) => {
      throw isMissing(error) ? FileError.notFound(from) : error;
    });
  }

  async move(from: string, to: string): Promise<void> {
    if (from === to) {
      await this.missing(from);

      return;
    }

    await this.copy(from, to);
    await this.delete(from);
  }

  async *list(prefix: string): AsyncIterable<ListedFile> {
    for await (const object of listObjects(this.client, this.bucket, this.keys.under(prefix))) {
      yield { ...object, key: this.keys.back(object.key) };
    }
  }

  async signedDownloadUrl(key: string, options: DownloadUrlOptions): Promise<SignedUrl> {
    const expiresIn = assertExpiry(options.expiresInSeconds);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.keys.of(key),
      ResponseContentDisposition: contentDisposition(options.fileName),
    });

    return { url: await getSignedUrl(this.client, command, { expiresIn }), expiresAt: this.expiry(expiresIn) };
  }

  async signedUploadUrl(key: string, options: UploadUrlOptions): Promise<SignedUpload> {
    const expiresIn = assertExpiry(options.expiresInSeconds);
    const mediaType = mediaTypeOf(options.mediaType);
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: this.keys.of(key), ContentType: mediaType });
    const url = await getSignedUrl(this.client, command, { expiresIn, signableHeaders: new Set(['content-type']) });

    return { url, method: 'PUT', headers: { 'content-type': mediaType }, expiresAt: this.expiry(expiresIn) };
  }

  private expiry(seconds: number): Date {
    return new Date(this.clock.now().getTime() + seconds * 1_000);
  }

  private async missing(key: string): Promise<void> {
    if ((await this.stat(key)) === undefined) {
      throw FileError.notFound(key);
    }
  }
}

function absentAsUndefined(error: unknown): undefined {
  if (isMissing(error)) {
    return undefined;
  }

  throw error;
}

interface ObjectHead {
  readonly ContentLength?: number | undefined;
  readonly ContentType?: string | undefined;
  readonly LastModified?: Date | undefined;
}

function metadataOf(key: string, head: ObjectHead): FileMetadata {
  return {
    key,
    size: head.ContentLength ?? 0,
    mediaType: mediaTypeOf(head.ContentType ?? 'application/octet-stream'),
    lastModified: head.LastModified ?? new Date(0),
  };
}
