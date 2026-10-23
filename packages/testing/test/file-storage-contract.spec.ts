import fs from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  InMemoryFileStorage,
  LocalFileStorage,
  contentDisposition,
  type ServedFileStorage,
} from '@ddd-ts-kit/kernel';
import { listenOnRandomPort, type RunningServer } from '../src/e2e';
import { fileStorageContract, followServed, type SignedRequest } from '../src/contracts';
import { readAll } from '../src/contracts/file-storage/read-all';

const runner = { describe, it, expect, beforeEach, afterEach };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const directories: string[] = [];

let clock = new FixedClock(NOW);
let storage: ServedFileStorage;

const elapse = (ms: number) => clock.advance(ms);
const follow = (request: SignedRequest) => followServed(storage)(request);

afterAll(async () => {
  await Promise.all(directories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

fileStorageContract(runner, {
  name: 'InMemoryFileStorage',
  createStorage: () => {
    clock = new FixedClock(NOW);
    storage = new InMemoryFileStorage({ clock, baseUrl: 'http://localhost/files' });

    return storage;
  },
  elapse,
  follow,
});

fileStorageContract(runner, {
  name: 'LocalFileStorage',
  createStorage: async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-ts-kit-files-'));

    directories.push(directory);
    clock = new FixedClock(NOW);

    storage = new LocalFileStorage({
      directory,
      clock,
      secret: 'a-secret-of-the-tests',
      baseUrl: 'http://localhost/files/',
    });

    return storage;
  },
  elapse,
  follow,
});

/** Answers the signed links of the storage of the test over HTTP, as the routes of an application do. */
async function serveSignedLinks(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const token = new URL(request.url ?? '/', 'http://localhost').searchParams.get('token') ?? '';

  if (request.method === 'GET') {
    const download = await storage.openSigned(token);

    if (download === undefined) {
      response.writeHead(403).end();

      return;
    }

    const body = await readAll(download.stream);

    response.writeHead(200, { 'content-disposition': contentDisposition(download.fileName) }).end(body);

    return;
  }

  const stored = await storage.acceptSigned(token, request, request.headers['content-type'] ?? '');

  response.writeHead(stored === undefined ? 403 : 200).end();
}

let server: RunningServer;

beforeAll(async () => {
  server = await listenOnRandomPort(createServer((request, response) => void serveSignedLinks(request, response)));
});

afterAll(() => server.close());

// Without `follow`, the contract follows each link over the network.
fileStorageContract(runner, {
  name: 'InMemoryFileStorage, its links served over HTTP',
  createStorage: () => {
    clock = new FixedClock(NOW);
    storage = new InMemoryFileStorage({ clock, baseUrl: `${server.url}/files` });

    return storage;
  },
  elapse,
});
