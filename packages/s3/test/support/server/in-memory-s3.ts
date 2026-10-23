import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type Incoming, incomingOf } from './incoming';
import { ObjectStore } from './object-store';
import type { StoredObject } from './shapes';
import { S3Error } from './s3-error';
import { type Credentials, verifySignature } from './signature-v4';
import { xml } from './xml';

const MAX_KEYS = 1_000;

interface Answer {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | Buffer;
}

/**
 * An S3 server in the process of the test, on a port of its own, so that the specs of the storage
 * run in the unit run too, through the real SDK, its signer and its HTTP transport. Path-style
 * addressing and Signature Version 4 in a header or in a signed link, checked as S3 checks them.
 * It keeps what the storage and its specs ask, answered as MinIO answers, from a recording of the
 * specs against it: buckets, objects, copies, listings by prefix page after page, multipart
 * uploads, the name a signed download is saved under. Its clock is the one of the process, moved
 * on by `elapse`, so that a link expires without waiting. A listing holds `pageSize` keys at most:
 * S3 may answer fewer keys than asked, and a small page shows the storage follows the next ones.
 * Not kept: versions, ranges, conditional requests, tags, access lists, a delimiter.
 */
export class InMemoryS3 {
  private offsetMs = 0;

  private readonly store = new ObjectStore(() => this.now());

  private constructor(
    private readonly server: Server,
    private readonly credentials: Credentials,
    private readonly pageSize: number,
  ) {
    server.on('request', (request: IncomingMessage, response: ServerResponse) => {
      void this.serve(request, response);
    });
  }

  static async start(credentials: Credentials, options: { readonly pageSize?: number } = {}): Promise<InMemoryS3> {
    const server = createServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    return new InMemoryS3(server, credentials, options.pageSize ?? MAX_KEYS);
  }

  get url(): string {
    const address = this.server.address();

    return `http://127.0.0.1:${String(typeof address === 'object' && address !== null ? address.port : 0)}`;
  }

  /** Moves the clock of the server on, as the time of a signed link passing. */
  elapse(ms: number): void {
    this.offsetMs += ms;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  private now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const incoming = await incomingOf(request).catch(() => undefined);

    if (incoming === undefined) {
      return;
    }

    const answer = this.answer(incoming);
    const body = request.method === 'HEAD' ? undefined : answer.body;

    response.writeHead(answer.status, { date: this.now().toUTCString(), ...answer.headers });
    response.end(body);
  }

  private answer(incoming: Incoming): Answer {
    try {
      verifySignature(incoming, this.credentials, this.now());

      return incoming.key === '' ? this.onBucket(incoming) : this.onObject(incoming);
    } catch (error) {
      const refusal = error instanceof S3Error ? error : new S3Error(500, 'InternalError', String(error));
      const body = xml.error(refusal.code, refusal.message, incoming.rawPath, incoming.key);

      return { status: refusal.status, headers: { 'content-type': 'application/xml' }, body };
    }
  }

  private onBucket(incoming: Incoming): Answer {
    const { method, bucket, query } = incoming;

    if (method === 'PUT') {
      this.store.createBucket(bucket);

      return { status: 200 };
    }

    if (method === 'GET' && query.get('list-type') === '2' && !query.has('delimiter')) {
      const asked = Number(query.get('max-keys') ?? MAX_KEYS);
      const token = query.get('continuation-token') ?? undefined;
      const page = this.store.list(bucket, query.get('prefix') ?? '', Math.min(asked, this.pageSize), token);

      return document(xml.listed(page));
    }

    if (method === 'GET' && query.has('uploads')) {
      const prefix = query.get('prefix') ?? '';

      return document(xml.uploads(bucket, prefix, this.store.uploads(bucket, prefix)));
    }

    throw S3Error.notImplemented(`${method} on a bucket`);
  }

  private onObject(incoming: Incoming): Answer {
    const { method, bucket, key, query, headers } = incoming;
    const uploadId = query.get('uploadId');

    if (method === 'PUT' && uploadId !== null) {
      return stored(this.store.uploadPart(bucket, uploadId, Number(query.get('partNumber')), incoming.body));
    }

    if (method === 'PUT' && headers['x-amz-copy-source'] !== undefined) {
      const copy = this.store.copy(bucket, key, decodeURIComponent(headers['x-amz-copy-source']));

      return { ...document(xml.copied(copy)), headers: { 'content-type': 'application/xml', etag: copy.etag } };
    }

    if (method === 'PUT') {
      const contentType = headers['content-type'] ?? 'application/octet-stream';

      return stored(this.store.put(bucket, key, incoming.body, contentType));
    }

    if (method === 'GET' || method === 'HEAD') {
      return served(this.store.get(bucket, key), query.get('response-content-disposition'));
    }

    if (method === 'DELETE') {
      if (uploadId === null) {
        this.store.delete(bucket, key);
      } else {
        this.store.abort(bucket, uploadId);
      }

      return { status: 204 };
    }

    if (method === 'POST' && query.has('uploads')) {
      const upload = this.store.initiate(bucket, key, headers['content-type'] ?? 'application/octet-stream');

      return document(xml.initiated(bucket, key, upload.id));
    }

    if (method === 'POST' && uploadId !== null) {
      const object = this.store.complete(bucket, uploadId, xml.partsOf(incoming.body.toString()));

      return document(xml.completed(bucket, key, object));
    }

    throw S3Error.notImplemented(`${method} on an object`);
  }
}

function document(body: string): Answer {
  return { status: 200, headers: { 'content-type': 'application/xml' }, body };
}

function stored(object: StoredObject): Answer {
  return { status: 200, headers: { etag: object.etag } };
}

function served(object: StoredObject, disposition: string | null): Answer {
  const headers: Record<string, string> = {
    'content-type': object.contentType,
    'content-length': String(object.body.length),
    'last-modified': object.lastModified.toUTCString(),
    etag: object.etag,
    ...(disposition === null ? {} : { 'content-disposition': disposition }),
  };

  return { status: 200, headers, body: object.body };
}
