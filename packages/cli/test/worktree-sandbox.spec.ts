import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';
import { type StubInstallers, stubInstallers } from './support/stub-installers';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US5.01 | ordering | skeleton | Order | \`generate aggregate ordering Order\` | | conductor | todo |
| 1 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --permission invoice.issue\` | | billing | todo |
`;

let root: string;
let installers: StubInstallers;

beforeAll(() => {
  installers = stubInstallers();
  root = fs.realpathSync(committedProject('shop', '--context', 'ordering:core', '--context', 'billing:core'));
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: plan');
  // A start point that is a branch records an upstream when git is told to always do it.
  git(root, 'config', 'branch.autoSetupMerge', 'always');
  // What the Claude Code sandbox leaves for the length of a session: git cannot lock .git/config.
  fs.writeFileSync(path.join(root, '.git', 'config.lock'), '');
  fs.chmodSync(path.join(root, '.git', 'config.lock'), 0o444);
});

afterAll(() => {
  fs.rmSync(path.join(root, '.git', 'config.lock'), { force: true });
  installers.restore();
});

describe('the commands that open a branch and a worktree, under a sandbox that keeps .git/config read-only', () => {
  it('worktree succeeds and records no upstream', () => {
    const opened = cli(root, 'worktree', 'sandboxed', '--no-install', '--json');

    expect(opened.code).toBe(0);
    expect(jsonAt(opened.json(), 'worktree')).toBe(path.join(root, '.worktrees', 'sandboxed'));
  });

  it('worker-scope succeeds, and run from inside a worktree it opens the new one under the main checkout', () => {
    const from = path.join(root, '.worktrees', 'sandboxed');
    const opened = cli(from, 'worker-scope', 'billing', '--no-install', '--json');

    expect(opened.code).toBe(0);
    expect(fs.realpathSync(String(jsonAt(opened.json(), 'worktree')))).toBe(path.join(root, '.worktrees', 'billing'));
    expect(fs.existsSync(path.join(from, '.worktrees'))).toBe(false);
    expect(git(root, 'branch', '--show-current').trim()).toBe('main');
  });

  it('story-scope succeeds, and run from inside a worktree it opens the new one under the main checkout', () => {
    const from = path.join(root, '.worktrees', 'sandboxed');
    const opened = cli(from, 'story-scope', 'US5', '--no-install', '--json');

    expect(opened.code).toBe(0);
    expect(fs.realpathSync(String(jsonAt(opened.json(), 'worktree')))).toBe(path.join(root, '.worktrees', 'us5'));
    expect(fs.existsSync(path.join(from, '.worktrees'))).toBe(false);
  });
});
