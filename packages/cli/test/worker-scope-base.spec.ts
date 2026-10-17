import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 4.14 | billing | slice | Draft invoice | \`generate command billing DraftInvoice --public\` | | billing | done |
| 4.15 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --public\` | | billing | todo |
| 4.16 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --public\` | | billing | todo |
| D4.01 | billing | slice | Refund invoice | \`generate command billing RefundInvoice --public\` | | billing | todo |
| 5.01 | shipping | slice | Ship | \`generate command shipping Ship --public\` | | shipping | todo |
| 5.02 | shipping | slice | Return | \`generate command shipping Return --public\` | | shipping | todo |
| 5.02 | shipping | slice | Return again | \`generate command shipping ReturnAgain --public\` | | shipping | todo |

Rules by slice

- #4.15: refuses an invoice without lines
- #4.15: refuses an invoice of a closed account
- #D4.01: refuses a refund above the amount paid
- 5.01: ships a paid order only
`;

let root: string;

beforeAll(() => {
  root = committedProject('shop', '--context', 'billing:core', '--context', 'shipping:supporting');
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: slices');
});

describe('worker-scope --rows', () => {
  it('briefs the rows asked for, in that order, ids kept as text, with the rules written under the tables', () => {
    const scope = cli(root, 'worker-scope', 'billing', '--rows', 'D4.01, #4.15', '--dry-run', '--json').json();
    const briefing = String(jsonAt(scope, 'briefing'));

    expect(jsonAt(scope, 'slices')).toEqual([
      expect.objectContaining({ id: 'D4.01', rules: 'refuses a refund above the amount paid' }),
      expect.objectContaining({
        id: '4.15',
        rules: 'refuses an invoice without lines; refuses an invoice of a closed account',
      }),
    ]);

    expect(briefing).toContain(
      '- #4.15 Issue invoice: `generate command billing IssueInvoice --public` ; rules: refuses an invoice without lines; refuses an invoice of a closed account',
    );

    expect(briefing).not.toContain('Cancel invoice');
    expect(briefing.indexOf('#D4.01')).toBeLessThan(briefing.indexOf('#4.15'));
  });

  it('reads a rule line written without the #', () => {
    const scope = cli(root, 'worker-scope', 'shipping', '--rows', '5.01', '--dry-run', '--json').json();

    expect(jsonAt(scope, 'slices')).toEqual([
      expect.objectContaining({ id: '5.01', rules: 'ships a paid order only' }),
    ]);
  });

  it('leaves the rules out of a row that has none, instead of a placeholder', () => {
    const briefing = String(
      jsonAt(cli(root, 'worker-scope', 'billing', '--rows', '4.16', '--dry-run', '--json').json(), 'briefing'),
    );

    expect(briefing).toContain('- #4.16 Cancel invoice: `generate command billing CancelInvoice --public`\n');
    expect(briefing).not.toContain('<invariants and failures by name>');
  });

  it('refuses a row the file does not have, a row of another context and a row numbered twice', () => {
    const unknown = cli(root, 'worker-scope', 'billing', '--rows', '4.1', '--dry-run');
    const other = cli(root, 'worker-scope', 'billing', '--rows', '5.01', '--dry-run');
    const twice = cli(root, 'worker-scope', 'shipping', '--rows', '5.02', '--dry-run');

    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('Row #4.1 is not in docs/architecture/slices.md.');
    expect(other.code).toBe(2);
    expect(other.stderr).toContain('Row #5.01 is owned by shipping, not by billing.');
    expect(twice.code).toBe(2);
    expect(twice.stderr).toContain('Row #5.02 appears 2 times in docs/architecture/slices.md.');
  });

  it('notes a row already done, and a briefing of more rows than an agent holds', () => {
    const done = jsonAt(cli(root, 'worker-scope', 'billing', '--rows', '4.14', '--dry-run', '--json').json(), 'notes');
    const all = jsonAt(cli(root, 'worker-scope', 'billing', '--dry-run', '--json').json(), 'notes');

    expect(done).toContainEqual(expect.stringContaining('Row #4.14 is marked done'));
    expect(all).toContainEqual(expect.stringContaining('3 rows in one briefing: an agent holds 2 at most'));
  });
});

describe('worker-scope --base', () => {
  it('cuts the worktree from the base and gives it as the trunk of the checks', () => {
    git(root, 'branch', 'release', 'HEAD');
    git(root, 'commit', '--quiet', '--allow-empty', '--message', 'chore: ahead of release');

    const scope = cli(root, 'worker-scope', 'billing', '--base', 'release', '--no-install', '--json');
    const worktree = String(jsonAt(scope.json(), 'worktree'));

    expect(scope.code).toBe(0);
    expect(scope.json()).toMatchObject({ trunk: 'release', created: true });
    expect(git(worktree, 'rev-parse', 'HEAD')).toBe(git(root, 'rev-parse', 'release'));
    expect(String(jsonAt(scope.json(), 'briefing'))).toContain('`npx ddd-ts-kit verify-slice billing --since release`');
  });

  it('refuses a base that names no commit', () => {
    const refused = cli(root, 'worker-scope', 'shipping', '--base', 'origin/nowhere', '--dry-run');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('The base origin/nowhere is not a commit of this repository.');
  });

  it('refuses a worktree that exists and does not contain the base, and keeps one that does', () => {
    const stale = cli(root, 'worker-scope', 'billing', '--no-install');

    expect(stale.code).toBe(2);

    expect(stale.stderr).toContain(
      'The branch build/billing does not contain main: its worker would build on a stale base.',
    );

    expect(cli(root, 'worker-scope', 'billing', '--base', 'release').code).toBe(0);
  });

  it('refuses a branch that exists without a worktree and does not contain the base', () => {
    git(root, 'branch', 'build/shipping', 'release');

    const refused = cli(root, 'worker-scope', 'shipping', '--dry-run');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('The branch build/shipping does not contain main');
  });

  it("refuses to take a worker's branch as the base when run from its worktree without --base", () => {
    const worktree = path.join(fs.realpathSync(path.dirname(root)), 'shop-billing');

    expect(read(worktree, '.ddd-ts-kit/worker.json')).toContain('billing');

    const refused = cli(worktree, 'worker-scope', 'shipping', '--dry-run');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('is the worktree of a worker (.ddd-ts-kit/worker.json is present)');
    expect(refused.stderr).toContain('`--base origin/main`');
  });
});
