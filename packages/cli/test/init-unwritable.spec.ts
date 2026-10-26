import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, walk } from './helpers';
import { NPM } from './support/npm';
import { VERSION } from '../src/version';
import { cannotWrite } from '../src/workspace/cannot-write';
import { writeIfAllowed } from '../src/workspace/write-if-allowed';

const FLAGS = [...NPM, '--agent-profile', 'regulated'];
const HOOKS = ['.claude/hooks/change-reference.mjs', '.claude/hooks/production-gate.mjs'];
const SETTINGS = '.claude/settings.json';

interface Report {
  readonly created: string[];
  readonly skipped: string[];
  readonly unwritable: string[];
  readonly notes: string[];
}

function reportOf(stdout: string): Report {
  const parsed: Report = JSON.parse(stdout);

  return parsed;
}

/** A directory named `shop`, so that two projects of these specs get the same name and the same files. */
function shop(): string {
  const root = path.join(tempDir('init-unwritable'), 'shop');

  fs.mkdirSync(root);

  return root;
}

/** What the sandbox of Claude Code mounts over a path it protects from the agent: `/dev/null`, a device. */
function mask(root: string, file: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.symlinkSync('/dev/null', path.join(root, file));
}

function contents(root: string): Record<string, string> {
  return Object.fromEntries(walk(root).map((file) => [file, read(root, file)]));
}

describe.skipIf(process.platform === 'win32')('init where a sandbox protects the agent files', () => {
  const reference = shop();

  cli(reference, 'init', ...FLAGS);

  const everyFile = walk(reference);

  it('writes every other file, lists the protected ones in skipped and unwritable, and gives the command to finish', () => {
    const root = shop();

    mask(root, '.claude/hooks');
    mask(root, SETTINGS);

    const dryRun = cli(root, 'init', ...FLAGS, '--dry-run', '--json');
    const run = cli(root, 'init', ...FLAGS, '--json');

    expect(dryRun.code).toBe(0);
    expect(reportOf(dryRun.stdout).unwritable).toEqual([...HOOKS, SETTINGS]);
    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');

    const report = reportOf(run.stdout);

    expect(report.unwritable).toEqual([...HOOKS, SETTINGS]);
    expect(report.skipped).toEqual(expect.arrayContaining([...HOOKS, SETTINGS]));
    expect(report.created).toHaveLength(everyFile.length - 3);
    expect(report.notes.join('\n')).not.toContain('is not a JSON object');

    expect(report.notes).toContainEqual(
      expect.stringContaining(
        `Every other file is written. To finish, the owner runs the same command from a terminal outside the sandbox, which writes these and keeps the files already written: \`npx ddd-ts-kit@${VERSION} init --package-manager npm --agent-profile regulated --cwd ${root}\`.`,
      ),
    );

    expect(walk(root).filter((file) => !file.startsWith('.claude/'))).toEqual(
      everyFile.filter((file) => !file.startsWith('.claude/')),
    );
  });

  it('run again where the paths are writable, writes the missing files and ends as one run would', () => {
    const root = shop();

    mask(root, '.claude/hooks');
    mask(root, SETTINGS);
    cli(root, 'init', ...FLAGS);
    fs.rmSync(path.join(root, '.claude/hooks'));
    fs.rmSync(path.join(root, SETTINGS));

    const finished = cli(root, 'init', ...FLAGS, '--json');

    expect(reportOf(finished.stdout).created.sort()).toEqual([...HOOKS, SETTINGS]);
    expect(reportOf(finished.stdout).unwritable).toEqual([]);
    expect(contents(root)).toEqual(contents(reference));
  });

  it.skipIf(process.getuid?.() === 0)('skips the files of a read-only folder the same way', () => {
    const root = shop();

    fs.mkdirSync(path.join(root, '.claude/hooks'), { recursive: true });
    fs.chmodSync(path.join(root, '.claude/hooks'), 0o555);

    const dryRun = cli(root, 'init', ...FLAGS, '--dry-run');
    const run = cli(root, 'init', ...FLAGS);

    fs.chmodSync(path.join(root, '.claude/hooks'), 0o755);

    expect(dryRun.stdout).toContain(
      'skipped      .claude/hooks/production-gate.mjs (cannot be written here: a sandbox or the permissions protect the path)',
    );

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('note: 2 file(s) could not be written here');
    expect(walk(root)).toEqual(everyFile.filter((file) => !HOOKS.includes(file)));
  });
});

describe('a path the workspace cannot write', () => {
  const tooLong = (): string => path.join(tempDir('init-unwritable'), 'x'.repeat(300), 'file.txt');

  it('is any path it cannot even look at', () => {
    expect(cannotWrite(tooLong())).toBe(true);
    expect(cannotWrite(path.join(tempDir('init-unwritable'), 'a', 'b.txt'))).toBe(false);
  });

  it('is skipped on the errors of a protected path only: any other error is thrown', () => {
    expect(() => writeIfAllowed(tooLong(), '')).toThrow(/ENAMETOOLONG/);
  });
});
