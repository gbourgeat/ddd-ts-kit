import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';
import { Workspace } from '../src/workspace';
import { filesGitDoesNotHold } from '../src/workspace/files-git-does-not-hold';
import { tempDir } from './helpers';

const AGGREGATE = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
const COMMITTED = 'Commit or stash them first, then run again: git diff shows what the kit rewrote.';

/** A project initialised with a context and an aggregate, everything committed: what a team has before an upgrade. */
function committedWithAnAggregate(): string {
  const root = initProject(...NPM, '--context', 'billing:core');

  expect(
    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=what a customer is asked to pay').code,
  ).toBe(0);

  commitAll(root);

  return root;
}

describe('--force never destroys work that git does not hold', () => {
  it('says of a file it leaves that it is kept, and that --force replaces it once committed', () => {
    const root = committedWithAnAggregate();

    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice').stdout).toContain(
      `skipped      ${AGGREGATE} (exists, kept; --force replaces it once it is committed)`,
    );
  });

  it('refuses generate --force over an edited file not committed, with exit code 2, the file named and kept', () => {
    const root = committedWithAnAggregate();

    write(root, AGGREGATE, `${read(root, AGGREGATE)}// a business rule written by hand\n`);

    const refused = cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--force');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      `--force would replace 1 file(s) that differ from the last commit, uncommitted or untracked: ${AGGREGATE}. Nothing was written.`,
    );

    expect(refused.stderr).toContain(COMMITTED);
    expect(read(root, AGGREGATE)).toContain('// a business rule written by hand');
  });

  it('names as it is a file only planned that --force writes over: nothing stands there to follow', () => {
    const ws = new Workspace(tempDir('nothing-on-disk'), true);

    ws.create('package.json', '{}\n');
    ws.replacing('package.json');

    expect(() => ws.commit(false)).toThrow('outside a git repository, where nothing else holds them: package.json.');
  });

  it('refuses an edit only staged, as the last commit does not hold it either', () => {
    const root = committedWithAnAggregate();

    write(root, AGGREGATE, `${read(root, AGGREGATE)}// staged, not committed\n`);
    git(root, 'add', AGGREGATE);

    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--force').code).toBe(2);
    expect(read(root, AGGREGATE)).toContain('// staged, not committed');
  });

  it('refuses init --force while a file it rewrites is edited or untracked, and writes none of the others', () => {
    const root = committedWithAnAggregate();
    const biome = read(root, 'biome.json');

    write(root, 'eslint.config.mjs', '// the lint of the team\n');
    write(root, 'biome.json', '{}\n');
    git(root, 'commit', '--quiet', '--all', '--message', 'chore: the lint of the team');
    write(root, 'biome.json', '{ "edited": true }\n');
    git(root, 'rm', '--quiet', '--cached', 'eslint.config.mjs');

    const refused = cli(root, 'init', '--force', '--dry-run');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      '2 file(s) that differ from the last commit, uncommitted or untracked: biome.json, eslint.config.mjs.',
    );

    expect(cli(root, 'init', '--force').code).toBe(2);
    expect(read(root, 'biome.json')).toBe('{ "edited": true }\n');
    expect(read(root, 'eslint.config.mjs')).toBe('// the lint of the team\n');
    expect(biome).not.toBe('{}\n');
  });

  it('replaces a committed file, and git diff shows what the kit rewrote', () => {
    const root = committedWithAnAggregate();

    write(root, AGGREGATE, '// mine, committed\n');
    commitAll(root);

    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--force').code).toBe(0);
    expect(read(root, AGGREGATE)).toContain('export class Invoice');
    expect(git(root, 'diff', '--name-only').split('\n')).toContain(AGGREGATE);
  });

  it('refuses --force where a folder stands in place of the committed file, and leaves the folder', () => {
    const root = committedWithAnAggregate();

    fs.rmSync(path.join(root, AGGREGATE));
    fs.mkdirSync(path.join(root, AGGREGATE));

    const refused = cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--force');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(`uncommitted or untracked: ${AGGREGATE}.`);
    expect(fs.statSync(path.join(root, AGGREGATE)).isDirectory()).toBe(true);
  });

  it('refuses init --force writing the script of the kit over an uncommitted script of the team', () => {
    const root = committedWithAnAggregate();
    const manifest = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };

    write(
      root,
      'package.json',
      `${JSON.stringify({ ...manifest, scripts: { ...manifest.scripts, test: 'mocha' } }, null, 2)}\n`,
    );

    const refused = cli(root, 'init', '--force');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('uncommitted or untracked: package.json.');
    expect(read(root, 'package.json')).toContain('"test": "mocha"');
  });

  it('outside a git repository, refuses to replace a file whose content differs, and replaces none whose content is the same', () => {
    const root = initProject(...NPM);

    expect(cli(root, 'init', '--force').code).toBe(0);

    write(root, 'biome.json', '{}\n');

    const refused = cli(root, 'init', '--force');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      '--force would replace 1 file(s) whose content differs from what the kit writes, outside a git repository, where nothing else holds them: biome.json. Nothing was written.',
    );

    expect(refused.stderr).toContain(
      'Keep a copy of what you wrote in them and delete them first, then run again; in a git repository, commit them first, and git diff shows what the kit rewrote.',
    );

    expect(read(root, 'biome.json')).toBe('{}\n');
  });
});

describe.skipIf(process.platform === 'win32')('the files git is asked about', () => {
  it('are read as they are written, never as patterns nor magic of git', () => {
    const root = tempDir('pathspecs');

    write(root, 'docs/[draft].md', 'One.\n');
    write(root, 'docs/d.md', 'Two.\n');
    write(root, ':notes.md', 'Three.\n');
    commitAll(root);
    write(root, 'docs/[draft].md', 'One, edited.\n');
    write(root, ':notes.md', 'Three, edited.\n');

    expect(filesGitDoesNotHold(root, ['docs/[draft].md', ':notes.md', 'docs/d.md'])).toEqual([
      'docs/[draft].md',
      ':notes.md',
    ]);
  });
});
