import type { RunningServer } from './running-server';

/** The part of a Node `http.Server` that `listenOnRandomPort` uses. */
export interface NodeServer {
  listen(port: number, host: string, onListening: () => void): unknown;
  once(event: 'error', onError: (error: Error) => void): unknown;
  address(): { readonly port: number } | string | null;
  close(onClosed: (error?: Error) => void): unknown;
}

const LOOPBACK = '127.0.0.1';

/** For `start`, when the application is a Node server: `listenOnRandomPort(createServer(app))`. */
export function listenOnRandomPort(server: NodeServer): Promise<RunningServer> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, () => resolve({ url: urlOf(server), close: () => closing(server) }));
  });
}

function urlOf(server: NodeServer): string {
  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new TypeError('The server does not listen on a TCP port');
  }

  return `http://${LOOPBACK}:${address.port}`;
}

function closing(server: NodeServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}
