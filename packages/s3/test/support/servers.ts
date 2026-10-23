import { randomBytes } from 'node:crypto';
import { CreateBucketCommand, S3ServiceException, type S3Client } from '@aws-sdk/client-s3';
import { s3ClientOf } from '../../src';

/** The server the specs run against, MinIO in the pipeline. Without it they are skipped. */
export const SERVER_URL = process.env['DDD_TS_KIT_TEST_S3_ENDPOINT'] ?? '';
export const REAL_SERVER = SERVER_URL !== '';
export const BUCKET = 'ddd-ts-kit-test';

export function connect(): S3Client {
  return s3ClientOf({
    endpoint: SERVER_URL,
    region: process.env['DDD_TS_KIT_TEST_S3_REGION'] ?? 'us-east-1',
    accessKeyId: process.env['DDD_TS_KIT_TEST_S3_ACCESS_KEY'] ?? 'ddd-ts-kit',
    secretAccessKey: process.env['DDD_TS_KIT_TEST_S3_SECRET_KEY'] ?? 'ddd-ts-kit-secret',
  });
}

/** The bucket of the specs, created once; each test writes under a prefix of its own and never empties it. */
export async function ensureBucket(client: S3Client): Promise<void> {
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch (error) {
    const owned = error instanceof S3ServiceException && error.name.startsWith('BucketAlready');

    if (!owned) {
      throw error;
    }
  }
}

export function aPrefix(): string {
  return `run-${randomBytes(6).toString('hex')}/`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
