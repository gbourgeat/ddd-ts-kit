import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { listenOnRandomPort, startTestServer, type NodeServer } from '../src/e2e';

/** Answers the headers it received, as JSON. */
const echo = () => createServer((request, response) => response.end(JSON.stringify(request.headers)));

describe('startTestServer', () => {
  it('binds a client that sends no header of its own when none is given', async () => {
    const server = await startTestServer({ start: () => listenOnRandomPort(echo()) });

    const { body } = await server.client.get<Record<string, string>>('/headers');

    await server.close();

    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(body.authorization).toBeUndefined();
  });
});

describe('listenOnRandomPort', () => {
  it('rejects the close of a server that no longer runs', async () => {
    const running = await listenOnRandomPort(echo());

    await running.close();

    await expect(running.close()).rejects.toThrow(/not running/);
  });

  it('refuses a server that does not listen on a TCP port', async () => {
    const onASocket: NodeServer = {
      listen: (_port, _host, onListening) => onListening(),
      once: () => undefined,
      address: () => '/run/billing.sock',
      close: (onClosed) => onClosed(),
    };

    await expect(listenOnRandomPort(onASocket)).rejects.toThrow(
      new TypeError('The server does not listen on a TCP port'),
    );
  });
});
