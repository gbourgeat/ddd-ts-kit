import { createServer, type IncomingMessage, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { multipartUploads } from '../src/uploads';

const SPEC = { field: 'document', maxBytes: 10_000_000, mediaTypes: ['application/pdf'] };
const BOUNDARY = 'XyZ';
const HEAD = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="document"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
const BEGINNING = `${HEAD}%PDF-1.7\n${'a'.repeat(5000)}`;

/** What became of storing the file once the client went away: settled, and how. */
async function storedFrom(request: IncomingMessage | PassThrough): Promise<string> {
  const headers = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}`, 'content-length': '100000' };

  const read = multipartUploads()(SPEC, {
    params: {},
    query: {},
    headers,
    body: undefined,
    raw: request,
    stream: request,
  });

  const { file } = await read;

  return new InMemoryFileStorage().put('k', file.stream, { mediaType: 'application/pdf' }).then(
    () => 'stored',
    () => 'refused',
  );
}

function portOf(address: AddressInfo | string | null | undefined): number {
  if (typeof address !== 'object' || address === null) {
    throw new Error('The server was expected to listen on a port');
  }

  return address.port;
}

describe('an upload the client abandons part-way', () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.close();
  });

  it('fails the file stream, so that storing it rejects instead of waiting forever', async () => {
    const request = new PassThrough();
    const outcome = storedFrom(request);

    request.write(BEGINNING);
    setTimeout(() => request.destroy(), 50);

    expect(await outcome).toBe('refused');
  });

  it('fails it as well when the connection of a real request drops', async () => {
    const outcome = new Promise<string>((resolve) => {
      server = createServer((request) => {
        void storedFrom(request).then(resolve);
      });
    });

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const port = portOf(server?.address());

    const socket = connect(port, '127.0.0.1', () => {
      socket.write(
        `POST / HTTP/1.1\r\nHost: x\r\nContent-Type: multipart/form-data; boundary=${BOUNDARY}\r\nContent-Length: 100000\r\n\r\n${BEGINNING}`,
      );

      setTimeout(() => socket.destroy(), 100);
    });

    expect(await outcome).toBe('refused');
  }, 5000);
});
