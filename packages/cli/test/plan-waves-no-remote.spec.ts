import { describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { commitAll } from './support/commit-all';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US1.01 | billing | slice | Issue invoice | \`generate aggregate billing Invoice --term "Invoice=What a customer owes"\` | | billing | todo |
`;

function projectWithPlan(): string {
  const root = initProject('--context', 'billing:core');

  write(root, 'docs/architecture/slices.md', SLICES);
  commitAll(root);

  return root;
}

const briefOf = (root: string): unknown =>
  jsonAt(cli(root, 'plan-waves', '--json').json(), 'waves', '0', 'batches', '0', 'brief');

describe('plan-waves, the base of a brief', () => {
  it('names no base in a repository with no remote, and the refusal of worker-scope says what to pass', () => {
    const root = projectWithPlan();

    expect(briefOf(root)).toBe('npx ddd-ts-kit worker-scope billing --rows US1.01');

    const refused = cli(root, 'worker-scope', 'billing', '--base', 'origin/main', '--rows', 'US1.01', '--dry-run');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('error: origin/main is not a commit of this repository.');
    expect(refused.stderr).toContain('`--base <branch, tag or commit>`');
    expect(refused.stderr).not.toContain('a commit: `--base origin/main`');
  });

  it('names origin/main once it resolves', () => {
    const root = projectWithPlan();

    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

    expect(briefOf(root)).toBe('npx ddd-ts-kit worker-scope billing --base origin/main --rows US1.01');
  });
});
