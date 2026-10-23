import type { IncomingMessage } from 'node:http';

/**
 * A request as the server reads it: path-style addressing (`/bucket/key`), the query as sent, its
 * headers in lower case and its whole body. The raw path and query stay for the signature, which
 * is computed on what the client sent, not on what it means.
 */
export interface Incoming {
  readonly method: string;
  readonly rawPath: string;
  readonly rawQuery: string;
  readonly bucket: string;
  readonly key: string;
  readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}

export async function incomingOf(request: IncomingMessage): Promise<Incoming> {
  const url = request.url ?? '/';
  const mark = url.indexOf('?');
  const rawPath = mark === -1 ? url : url.slice(0, mark);
  const rawQuery = mark === -1 ? '' : url.slice(mark + 1);
  const [bucket = '', ...key] = rawPath.slice(1).split('/');

  return {
    method: request.method ?? 'GET',
    rawPath,
    rawQuery,
    bucket: decodeURIComponent(bucket),
    key: decodeURIComponent(key.join('/')),
    query: new URLSearchParams(rawQuery),
    headers: headersOf(request),
    body: await bodyOf(request),
  };
}

function headersOf(request: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers[name] = Array.isArray(value) ? value.join(',') : value;
    }
  }

  return headers;
}

async function bodyOf(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks);
}
