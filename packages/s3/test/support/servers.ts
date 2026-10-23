import { randomBytes } from 'node:crypto';
import { CreateBucketCommand, S3ServiceException, type S3Client } from '@aws-sdk/client-s3';
import { s3ClientOf } from '../../src';
import { InMemoryS3 } from './server/in-memory-s3';

export const BUCKET = 'ddd-ts-kit-test';

const CREDENTIALS = {
  accessKeyId: process.env['DDD_TS_KIT_TEST_S3_ACCESS_KEY'] ?? 'ddd-ts-kit',
  secretAccessKey: process.env['DDD_TS_KIT_TEST_S3_SECRET_KEY'] ?? 'ddd-ts-kit-secret',
};

/** A server the specs run on, with a client and the bucket of the specs, and how its time passes. */
export interface S3Server {
  readonly client: S3Client;
  /** A client of the same server that signs with a secret the server does not know. */
  readonly stranger: S3Client;
  /** Makes the time of the signed links pass. */
  elapse(ms: number): Promise<void>;
  stop(): Promise<void>;
}

type ServerRow = readonly [name: string, start: () => Promise<S3Server>];

/** The real server named by `DDD_TS_KIT_TEST_S3_ENDPOINT`, MinIO in the pipeline: time passes by waiting. */
async function onEndpoint(endpoint: string): Promise<S3Server> {
  const client = await connect(endpoint);
  const stranger = strangerOf(endpoint);

  return {
    client,
    stranger,
    elapse: sleep,
    async stop() {
      client.destroy();
      stranger.destroy();
    },
  };
}

/**
 * A server of its own, in the process, closed by `stop`. A listing page holds two keys, so that
 * every listing of more than two files is read page after page.
 */
async function inMemory(): Promise<S3Server> {
  const server = await InMemoryS3.start(CREDENTIALS, { pageSize: 2 });
  const client = await connect(server.url);
  const stranger = strangerOf(server.url);

  return {
    client,
    stranger,
    elapse: (ms) => Promise.resolve(server.elapse(ms)),
    async stop() {
      client.destroy();
      stranger.destroy();
      await server.stop();
    },
  };
}

const endpoint = process.env['DDD_TS_KIT_TEST_S3_ENDPOINT'] ?? '';
const real: readonly ServerRow[] = endpoint === '' ? [] : [['on MinIO', () => onEndpoint(endpoint)]];

/**
 * The servers the specs run on: the in-memory one always, a real one when
 * `DDD_TS_KIT_TEST_S3_ENDPOINT` names it. As `[name, start]` rows for `describe.each`.
 */
export const SERVERS: readonly ServerRow[] = [['in memory', inMemory], ...real];

const REGION = process.env['DDD_TS_KIT_TEST_S3_REGION'] ?? 'us-east-1';

async function connect(endpoint: string): Promise<S3Client> {
  const client = s3ClientOf({ endpoint, region: REGION, ...CREDENTIALS });

  await ensureBucket(client);

  return client;
}

function strangerOf(endpoint: string): S3Client {
  return s3ClientOf({
    endpoint,
    region: REGION,
    ...CREDENTIALS,
    secretAccessKey: `${CREDENTIALS.secretAccessKey}-wrong`,
  });
}

/** The bucket of the specs, created once; each test writes under a prefix of its own and never empties it. */
async function ensureBucket(client: S3Client): Promise<void> {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
