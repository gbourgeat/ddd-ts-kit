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

const REPO = path.resolve(import.meta.dirname, '../../..');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');
const BIN = path.join(REPO, 'packages/cli/src/bin.ts');
const COMPOSITION = 'src/platform/composition/compose-application.ts';
const LOCK = '.ddd-ts-kit/lock';
const HOLDER = 'ddd-ts-kit generate context billing --classification core';

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

/** The lock as a command holding it left it: its folder, and the file that names the command. */
function heldLock(root: string, holder: { readonly pid: number; readonly secondsAgo: number }): void {
  fs.mkdirSync(path.join(root, LOCK), { recursive: true });

  fs.writeFileSync(
    path.join(root, LOCK, 'holder.json'),
    JSON.stringify({
      command: HOLDER,
      pid: holder.pid,
      host: os.hostname(),
      startedAt: new Date(Date.now() - holder.secondsAgo * 1000).toISOString(),
    }),
  );
}

function declaredContexts(root: string): string[] {
  const contexts = jsonAt(JSON.parse(read(root, 'ddd-ts-kit.config.json')), 'contexts');

  return typeof contexts === 'object' && contexts !== null ? Object.keys(contexts) : [];
}

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

  it('take over a lock taken more than a minute ago, and one whose process has ended, then release it', () => {
    const root = initProject(...NPM);
    const ended = spawnSync(process.execPath, ['-e', '']).pid ?? 0;

    heldLock(root, { pid: process.pid, secondsAgo: 120 });
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
    expect(exists(root, LOCK)).toBe(false);

    heldLock(root, { pid: ended, secondsAgo: 1 });
    expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'core').code).toBe(0);
    expect(exists(root, LOCK)).toBe(false);
    expect(declaredContexts(root)).toEqual(['billing', 'shipping']);
  });

  it('refuse with exit code 2 once the wait is over, naming the command that holds the lock and the fix, and write nothing', () => {
    const root = initProject(...NPM);
    const config = read(root, 'ddd-ts-kit.config.json');

    heldLock(root, { pid: process.pid, secondsAgo: 12 });

    const refused = cli(root, 'generate', 'context', 'shipping', '--classification', 'core', '--json');
    const error = jsonAt(refused.json(), 'error');

    expect(refused.code).toBe(2);

    expect(String(jsonAt(error, 'message'))).toMatch(
      new RegExp(
        `^Another generator holds the lock of this project: \`${HOLDER}\` \\(pid ${process.pid}, started 1\\d seconds ago\\)\\. This command waited for it and wrote nothing\\.$`,
      ),
    );

    expect(jsonAt(error, 'fix')).toBe(
      'Run the generators one after the other: run this command again once that one has ended. A lock whose command has ended is taken over, and so is one taken more than a minute ago; to take it at once, remove .ddd-ts-kit/lock.',
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
