import { createServer, type Server } from 'node:http';

/** One request the API received. */
export interface ReceivedPurge {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string;
}

/** The purge API of a cache, standing in for Varnish or a CDN: it records what it receives and answers `status`. */
export interface RecordingCacheApi {
  readonly url: string;
  readonly received: ReceivedPurge[];
  answerWith(status: number): void;
  close(): Promise<void>;
}

export async function startRecordingCacheApi(): Promise<RecordingCacheApi> {
  const received: ReceivedPurge[] = [];
  let status = 200;

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => chunks.push(chunk));

    request.on('end', () => {
      received.push({
        method: request.method ?? '',
        path: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.writeHead(status, { 'content-type': 'application/json' });
      response.end('{"success":true}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    received,
    answerWith: (next) => {
      status = next;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
