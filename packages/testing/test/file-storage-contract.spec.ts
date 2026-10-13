import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, InMemoryFileStorage, LocalFileStorage, type ServedFileStorage } from '@ddd-ts-kit/kernel';
import { fileStorageContract, followServed, type SignedRequest } from '../src/contracts.js';

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
