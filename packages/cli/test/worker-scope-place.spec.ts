import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

let main: string;
let trunk: string;

beforeAll(() => {
  main = fs.realpathSync(committedProject('shop', '--context', 'billing:core', '--context', 'shipping:supporting'));
  trunk = path.join(main, '.worktrees', 'wave7');
  git(main, 'worktree', 'add', '--quiet', '-b', 'wave7', trunk);
});

describe('worker-scope --worktree run from a trunk worktree', () => {
  it('resolves a relative path under .worktrees/ against the main checkout, as the default place does', () => {
    const scope = cli(
      trunk,
      'worker-scope',
      'billing',
      '--worktree',
      '.worktrees/billing-w7a',
      '--base',
      'wave7',
      '--json',
    ).json();

    expect(fs.realpathSync(String(jsonAt(scope, 'worktree')))).toBe(path.join(main, '.worktrees', 'billing-w7a'));
    expect(exists(trunk, '.worktrees/billing-w7a')).toBe(false);
    expect(JSON.stringify(jsonAt(scope, 'notes'))).toContain('the one of the main checkout');
  });

  it('finds that worker again from the trunk worktree by the same path', () => {
    const resumed = cli(trunk, 'worker-scope', 'billing', '--resume', '--worktree', '.worktrees/billing-w7a', '--json');

    expect(resumed.code).toBe(0);
  });

  it('keeps any other relative path against the current root', () => {
    const scope = cli(
      trunk,
      'worker-scope',
      'shipping',
      '--worktree',
      '../elsewhere',
      '--base',
      'wave7',
      '--json',
    ).json();

    expect(fs.realpathSync(String(jsonAt(scope, 'worktree')))).toBe(path.join(main, '.worktrees', 'elsewhere'));
  });
});
