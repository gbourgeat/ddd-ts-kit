import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, walk, write } from './helpers';
import { NPM } from './support/npm';
import { runInit, type InitOptions } from '../src/init/run-init';
import { Workspace, type DiskWrites } from '../src/workspace';
import { writeIfAllowed } from '../src/workspace/write-if-allowed';

const OPTIONS: InitOptions = { contexts: [], dryRun: false, force: false, packageManager: 'npm' };

/** A directory named `shop`, so that two projects of these specs get the same name and the same files. */
function shop(): string {
  const root = path.join(tempDir('atomic-writes'), 'shop');

  fs.mkdirSync(root);

  return root;
}

/** A disk that writes half of the `k`-th file, then fails: what a process stopped in the middle of that file leaves. */
function stoppingAt(k: number): DiskWrites {
  let files = 0;

  return {
    writeFileSync(file, content) {
      files += 1;

      if (files === k) {
        fs.writeFileSync(file, content.slice(0, Math.floor(content.length / 2)));

        throw new Error('stopped half way through a file');
      }

      fs.writeFileSync(file, content);
    },
    renameSync: (from, to) => fs.renameSync(from, to),
  };
}

function contents(root: string, files = walk(root)): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file, read(root, file)]));
}

describe('the writes of init and generate', () => {
  it('stopped half way through a file leave complete files only and no temporary file, and the same init run again completes the project', () => {
    const reference = shop();

    expect(cli(reference, 'init', ...NPM).code).toBe(0);

    const root = shop();
    const k = Math.floor(walk(reference).length / 2);

    expect(() => runInit(root, OPTIONS, stoppingAt(k))).toThrow('stopped half way through a file');

    const present = walk(root);

    expect(present.filter((file) => file.endsWith('.tmp'))).toEqual([]);
    expect(present).toHaveLength(k - 1);
    expect(contents(root, present)).toEqual(contents(reference, present));

    expect(cli(root, 'init', ...NPM).code).toBe(0);
    expect(contents(root)).toEqual(contents(reference));
  });

  it.skipIf(process.platform === 'win32')(
    'write over a file keeping its mode, and through a link to the file it points at, the link kept',
    () => {
      const root = tempDir('atomic-writes');

      write(root, 'AGENTS.md', 'earlier\n');
      fs.symlinkSync('AGENTS.md', path.join(root, 'CLAUDE.md'));
      write(root, 'hook.sh', 'earlier\n');
      fs.chmodSync(path.join(root, 'hook.sh'), 0o755);

      expect(writeIfAllowed(path.join(root, 'CLAUDE.md'), 'written\n')).toBe(true);
      expect(writeIfAllowed(path.join(root, 'hook.sh'), 'written\n')).toBe(true);

      expect(fs.lstatSync(path.join(root, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
      expect(read(root, 'AGENTS.md')).toBe('written\n');
      expect(fs.statSync(path.join(root, 'hook.sh')).mode & 0o777).toBe(0o755);
      expect(fs.readdirSync(root).sort()).toEqual(['AGENTS.md', 'CLAUDE.md', 'hook.sh']);
    },
  );

  it('write a file that is a mount point in place, where the rename answers EBUSY', () => {
    const root = tempDir('atomic-writes');

    const busy: DiskWrites = {
      writeFileSync: (file, content) => fs.writeFileSync(file, content),
      renameSync: () => {
        throw Object.assign(new Error('resource busy or locked'), { code: 'EBUSY' });
      },
    };

    write(root, 'ddd-ts-kit.config.json', 'earlier\n');

    expect(writeIfAllowed(path.join(root, 'ddd-ts-kit.config.json'), 'written\n', { disk: busy })).toBe(true);
    expect(read(root, 'ddd-ts-kit.config.json')).toBe('written\n');
    expect(fs.readdirSync(root)).toEqual(['ddd-ts-kit.config.json']);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'skip a read-only file of the plan in a dry run and in the real run alike',
    () => {
      const root = tempDir('atomic-writes');

      write(root, 'locked.txt', 'earlier\n');
      fs.chmodSync(path.join(root, 'locked.txt'), 0o444);

      const [dryRun, real] = [true, false].map((dry) => {
        const ws = new Workspace(root, false);

        ws.update('locked.txt', 'written\n');

        return ws.commit(dry);
      });

      expect(dryRun).toMatchObject({ unwritable: ['locked.txt'], updated: [] });
      expect(real).toMatchObject({ unwritable: ['locked.txt'], updated: [] });
      expect(read(root, 'locked.txt')).toBe('earlier\n');
      expect(fs.readdirSync(root)).toEqual(['locked.txt']);
    },
  );
});
