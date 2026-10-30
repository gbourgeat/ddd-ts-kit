import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { NPM } from './support/npm';
import { withGeneratorLock } from '../src/generator-lock';
import { holderOf } from '../src/generator-lock/holder-of';
import { removeStale } from '../src/generator-lock/remove-stale';

const REPO = path.resolve(import.meta.dirname, '../../..');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');
const BIN = path.join(REPO, 'packages/cli/src/bin.ts');
const COMPOSITION = 'src/platform/composition/compose-application.ts';
const LOCK = '.ddd-ts-kit/lock';
const HOLDER = 'ddd-ts-kit generate context billing --classification core';
/** How long before the command under test the holder of a lock took it, in seconds. */
const HEAD_START = 2;
/** A wait short enough for a spec that calls the lock itself. */
const SHORT_WAIT = { waitMs: 200, pollMs: 50, staleMs: 60_000 };

interface Ended {
  readonly code: number | null;
  readonly stderr: string;
}

/** The CLI in a process of its own, on its sources: what two people, or two sessions, start in one checkout. */
function started(root: string, ...args: string[]): Promise<Ended> {
  return new Promise((resolve, reject) => {
    const child = spawn(TSX, [BIN, ...args, '--cwd', root], { cwd: REPO });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

interface Holder {
  readonly pid: number;
  readonly secondsAgo: number;
  /** This machine unless said. */
  readonly host?: string;
}

/** The lock as a command holding it left it: its folder, and the file that names the command. */
function heldLock(root: string, holder: Holder): void {
  fs.mkdirSync(path.join(root, LOCK), { recursive: true });

  fs.writeFileSync(
    path.join(root, LOCK, 'holder.json'),
    JSON.stringify({
      command: HOLDER,
      pid: holder.pid,
      host: holder.host ?? os.hostname(),
      startedAt: new Date(Date.now() - holder.secondsAgo * 1000).toISOString(),
    }),
  );
}

function declaredContexts(root: string): string[] {
  const contexts = jsonAt(JSON.parse(read(root, 'ddd-ts-kit.config.json')), 'contexts');

  return typeof contexts === 'object' && contexts !== null ? Object.keys(contexts) : [];
}

describe('a lock that reads as nothing', () => {
  it('is refused once the wait is over when it is a link to nothing, and nothing runs', () => {
    const root = tempDir('lock-link');

    fs.mkdirSync(path.join(root, '.ddd-ts-kit'));
    fs.symlinkSync(path.join(root, 'nowhere'), path.join(root, LOCK));

    let ran = false;

    expect(() =>
      withGeneratorLock({ root, command: HOLDER, timing: SHORT_WAIT }, () => {
        ran = true;
      }),
    ).toThrow('stands there and cannot be read');

    expect(ran).toBe(false);
  });
});

describe('two generators that write the shared files of one project', () => {
  it('started together both land in the config and the composition root, or one is refused with the reason', async () => {
    const root = initProject(...NPM);
    const names = ['billing', 'shipping'];

    const ended = await Promise.all(
      names.map((name) => started(root, 'generate', 'context', name, '--classification', 'core')),
    );

    const landed = names.filter((_, at) => ended[at]?.code === 0);

    for (const { code, stderr } of ended.filter((result) => result.code !== 0)) {
      expect({ code, refused: stderr.includes('Another generator holds the lock of this project') }).toEqual({
        code: 2,
        refused: true,
      });
    }

    expect(landed.length, ended.map(({ stderr }) => stderr).join('\n')).toBeGreaterThan(0);
    expect(declaredContexts(root)).toEqual(expect.arrayContaining(landed));

    for (const name of landed) {
      expect(read(root, COMPOSITION)).toContain(`contextModule('${name}'`);
    }

    expect(exists(root, LOCK)).toBe(false);
  }, 60_000);

  it('take over a lock of another machine taken more than a minute ago, and one whose process has ended on this machine, then release it', () => {
    const root = initProject(...NPM);
    const ended = spawnSync(process.execPath, ['-e', '']).pid ?? 0;

    heldLock(root, { pid: process.pid, secondsAgo: 120, host: 'another-machine' });
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
    expect(exists(root, LOCK)).toBe(false);

    heldLock(root, { pid: ended, secondsAgo: 1 });
    expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'core').code).toBe(0);
    expect(exists(root, LOCK)).toBe(false);
    expect(declaredContexts(root)).toEqual(['billing', 'shipping']);
  });

  it('keep the lock of a command that runs on this machine, however long ago it was taken', () => {
    const root = initProject(...NPM);
    let ran = false;

    heldLock(root, { pid: process.pid, secondsAgo: 600 });

    expect(() =>
      withGeneratorLock({ root, command: 'ddd-ts-kit generate context shipping', timing: SHORT_WAIT }, () => {
        ran = true;
      }),
    ).toThrow(
      `Another generator holds the lock of this project: \`${HOLDER}\` (pid ${process.pid}, started 600 seconds ago).`,
    );

    expect(ran).toBe(false);
    expect(exists(root, LOCK)).toBe(true);
  });

  it('leave no lock behind when the holder file cannot be written, and throw what the disk answered', () => {
    const root = initProject(...NPM);
    let ran = false;

    const disk = {
      writeFileSync: (): void => {
        throw new Error('no space left on the device');
      },
    };

    expect(() =>
      withGeneratorLock({ root, command: 'ddd-ts-kit generate context shipping', disk }, () => {
        ran = true;
      }),
    ).toThrow('no space left on the device');

    expect(ran).toBe(false);
    expect(exists(root, '.ddd-ts-kit')).toBe(false);
  });

  it('refuse with exit code 2 once the wait is over, naming the command that holds the lock and the fix, and write nothing', () => {
    const root = initProject(...NPM);
    const config = read(root, 'ddd-ts-kit.config.json');

    heldLock(root, { pid: process.pid, secondsAgo: HEAD_START });

    const refused = cli(root, 'generate', 'context', 'shipping', '--classification', 'core', '--json');
    const error = jsonAt(refused.json(), 'error');

    expect(refused.code).toBe(2);

    const message = String(jsonAt(error, 'message'));
    const seconds = Number(/started (\d+) seconds ago/.exec(message)?.[1]);

    expect(message).toMatch(
      new RegExp(
        `^Another generator holds the lock of this project: \`${HOLDER}\` \\(pid ${process.pid}, started \\d+ seconds ago\\)\\. This command waited for it and wrote nothing\\.$`,
      ),
    );

    // The head start of the holder, then the five seconds of the wait: however slowly the runner went.
    expect(seconds).toBeGreaterThanOrEqual(HEAD_START + 5);

    expect(jsonAt(error, 'fix')).toBe(
      'Run the generators one after the other: run this command again once that one has ended. A lock taken on this machine is kept while its command runs and taken over once it has ended; one taken on another machine, or whose holder cannot be read, is taken over a minute after it was taken. To take it at once, remove .ddd-ts-kit/lock.',
    );

    expect(read(root, 'ddd-ts-kit.config.json')).toBe(config);
    expect(exists(root, LOCK)).toBe(true);
  }, 30_000);

  it.skipIf(process.platform === 'win32')(
    'take no lock through a .ddd-ts-kit that is a symbolic link, and write nothing where it points',
    () => {
      const root = initProject(...NPM);
      const elsewhere = tempDir('lock-elsewhere');

      fs.symlinkSync(elsewhere, path.join(root, '.ddd-ts-kit'));

      expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
      expect(fs.readdirSync(elsewhere)).toEqual([]);
      expect(declaredContexts(root)).toEqual(['billing']);
    },
  );

  it('hold their lock where git ignores it in a project init wrote', () => {
    const root = initProject(...NPM);

    git(root, 'init', '--quiet');

    expect(
      spawnSync('git', ['check-ignore', '--quiet', '--no-index', `${LOCK}/holder.json`], { cwd: root }).status,
    ).toBe(0);
  });
});

describe('the lock of the generators, its folder and its holder', () => {
  it('take no lock where no folder can be made for it, and run as without one', () => {
    const root = initProject(...NPM);

    fs.writeFileSync(path.join(root, '.ddd-ts-kit'), 'a file where the kit folder goes\n');

    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
    expect(declaredContexts(root)).toEqual(['billing']);
    expect(fs.statSync(path.join(root, '.ddd-ts-kit')).isFile()).toBe(true);
  });

  it('read the holder of a lock from its folder alone when its file is not JSON, and none once the folder is gone', () => {
    const root = initProject(...NPM);
    const lock = path.join(root, LOCK);

    fs.mkdirSync(lock, { recursive: true });
    fs.writeFileSync(path.join(lock, 'holder.json'), '{ not json');

    expect(holderOf(lock)).toEqual({ startedAt: fs.statSync(lock).mtimeMs });

    fs.rmSync(lock, { recursive: true });

    expect(holderOf(lock)).toBeUndefined();
  });

  it('remove a stale lock only while it is the one judged stale, and leave one that cannot be moved aside', () => {
    const root = initProject(...NPM);
    const lock = path.join(root, LOCK);
    const judged = { startedAt: 1, pid: 1 };

    heldLock(root, { pid: process.pid, secondsAgo: 600 });
    removeStale(lock, judged);

    expect(exists(root, LOCK)).toBe(true);

    const holder = holderOf(lock);

    expect(holder).toBeDefined();

    if (holder === undefined) {
      return;
    }

    fs.chmodSync(path.join(root, '.ddd-ts-kit'), 0o555);

    try {
      removeStale(lock, holder);
      expect(exists(root, LOCK)).toBe(true);
    } finally {
      fs.chmodSync(path.join(root, '.ddd-ts-kit'), 0o755);
    }

    removeStale(lock, holder);

    expect(exists(root, LOCK)).toBe(false);
  });
});
