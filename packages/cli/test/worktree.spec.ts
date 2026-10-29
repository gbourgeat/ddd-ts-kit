import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';
import { type StubInstallers, stubInstallers } from './support/stub-installers';

let root: string;
let installers: StubInstallers;

beforeAll(() => {
  installers = stubInstallers();
  root = fs.realpathSync(committedProject('shop', '--context', 'billing:core'));
});

afterAll(() => installers.restore());

describe('worktree', () => {
  it('says what it would open, and creates nothing in a dry run', () => {
    const planned = cli(root, 'worktree', 'invoice-totals', '--dry-run', '--json').json();

    expect(planned).toMatchObject({
      name: 'invoice-totals',
      dryRun: true,
      worktree: path.join(root, '.worktrees', 'invoice-totals'),
      branch: 'work/invoice-totals',
      base: 'main',
      created: true,
      notes: [],
    });

    expect(fs.existsSync(path.join(root, '.worktrees'))).toBe(false);
  });

  it('opens .worktrees/<name> on work/<name>, ignored by git, and installs it', () => {
    const opened = cli(root, 'worktree', 'invoice-totals');
    const worktree = path.join(root, '.worktrees', 'invoice-totals');

    expect(opened.code).toBe(0);
    expect(opened.stdout).toContain(`worktree created: ${worktree} (branch work/invoice-totals, base main)`);

    expect(opened.stdout).toContain(
      'note: dependencies installed in the worktree with `pnpm install --frozen-lockfile`',
    );

    expect(git(worktree, 'branch', '--show-current').trim()).toBe('work/invoice-totals');
    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(cli(root, 'worktree', 'invoice-totals').stdout).toContain('worktree kept, the work resumes');
  });

  it('opens a worktree asked from another one in the main checkout, and says what an uninstalled one borrows', () => {
    const from = path.join(root, '.worktrees', 'invoice-totals');
    const opened = cli(from, 'worktree', 'refunds', '--no-install', '--json').json();

    expect(jsonAt(opened, 'worktree')).toBe(path.join(root, '.worktrees', 'refunds'));
    expect(String(jsonAt(opened, 'notes'))).toContain('Node resolves the packages of the main checkout above it');
  });

  it('refuses a name that cannot name a worktree', () => {
    const refused = cli(root, 'worktree', '../out');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('"../out" cannot name a worktree.');
  });

  it('opens next to a project whose .gitignore does not hold .worktrees/ yet, until init adds it', () => {
    write(root, '.gitignore', read(root, '.gitignore').replace('.worktrees/\n', ''));

    const beside = cli(root, 'worktree', 'audit', '--no-install', '--json').json();

    expect(jsonAt(beside, 'worktree')).toBe(path.join(path.dirname(root), 'shop-audit'));

    expect(String(jsonAt(beside, 'notes'))).toContain(
      '.worktrees/ is not ignored by git yet: the worktree is opened next to the project.',
    );

    expect(jsonAt(cli(root, 'story-scope', 'US7', '--dry-run', '--json').json(), 'worktree')).toBe(
      path.join(path.dirname(root), 'shop-us7'),
    );

    expect(cli(root, 'story-scope', 'US7', '--worktree', '.worktrees/us7').stderr).toContain(
      '.worktrees/us7 is not ignored by git',
    );

    const again = cli(root, 'init', '--json').json();

    expect(String(jsonAt(again, 'notes'))).toContain('.gitignore now ignores .worktrees/');
    expect(read(root, '.gitignore')).toMatch(/^# Lines of ddd-ts-kit init: [^\n]*\n\.worktrees\/\n/);

    expect(jsonAt(cli(root, 'worktree', 'review', '--no-install', '--json').json(), 'worktree')).toBe(
      path.join(root, '.worktrees', 'review'),
    );
  });
});

describe('the worktrees setting', () => {
  it('is required in a new project, and reported when it holds a value it does not know', () => {
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as Record<string, unknown>;

    expect(config['worktrees']).toBe('required');
    expect(config['formatOnWrite']).toBe(true);

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ ...config, worktrees: 'sometimes' }));

    expect(cli(root, 'check', '--rule', 'config/valid').stdout).toContain('"worktrees" is "sometimes".');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config));
  });
});
