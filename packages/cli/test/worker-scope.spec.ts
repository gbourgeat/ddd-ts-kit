import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';
import { type StubInstallers, stubInstallers } from './support/stub-installers';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` | | conductor | done |
| 2 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\` | 1 | billing | todo |
| 3 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --permission invoice.cancel\` | 1 | billing | done |
| 4 | shipping | slice | Ship | \`generate command shipping Ship --public\` | | shipping | todo |

## Milestone 2

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 5 | billing | slice | Refund invoice | \`generate command billing RefundInvoice --aggregate Invoice --permission invoice.refund\` | 2 | billing | todo |
`;

/** The scope of the worker of billing: the context the guard reads, then what `status --workers` shows, with the commit of its base. */
const BILLING_SCOPE = { context: 'billing', rows: ['2'], base: 'main', branch: 'build/billing' };

let root: string;
let worktree: string;
let installers: StubInstallers;

beforeAll(() => {
  installers = stubInstallers();
  root = committedProject('shop', '--context', 'billing:core', '--context', 'shipping:supporting');
  worktree = path.join(fs.realpathSync(root), '.worktrees', 'billing');
  write(root, 'docs/architecture/slices.md', SLICES);
});

afterAll(() => installers.restore());

describe('worker-scope', () => {
  it('refuses a context the config does not know', () => {
    const unknown = cli(root, 'worker-scope', 'catalog');

    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('Unknown context "catalog".');
  });

  it('with --dry-run says what it would do and creates nothing', () => {
    const planned = cli(root, 'worker-scope', 'billing', '--dry-run', '--json').json();

    expect(planned).toMatchObject({
      dryRun: true,
      context: 'billing',
      project: 'shop',
      branch: 'build/billing',
      trunk: 'main',
      created: true,
    });

    expect(fs.existsSync(worktree)).toBe(false);
    expect(git(root, 'branch', '--list', 'build/billing').trim()).toBe('');
  });

  it('creates the worktree in .worktrees/ of the project, on the branch build/<context>, with the scope of the worker', () => {
    const scope = cli(root, 'worker-scope', 'billing', '--json');

    expect(scope.code).toBe(0);
    expect(fs.realpathSync(String(jsonAt(scope.json(), 'worktree')))).toBe(worktree);

    expect(jsonAt(scope.json(), 'notes')).toContainEqual(
      expect.stringMatching(
        /^dependencies installed in the worktree with `pnpm install --frozen-lockfile` \([\d.]+ s\)\.$/,
      ),
    );

    expect(scope.json()).toMatchObject({
      created: true,
      branch: 'build/billing',
      trunk: 'main',
      scopeFile: path.join(String(jsonAt(scope.json(), 'root')), '.ddd-ts-kit/worker.json'),
    });

    expect(JSON.parse(read(worktree, '.ddd-ts-kit/worker.json'))).toEqual({
      ...BILLING_SCOPE,
      baseCommit: git(root, 'rev-parse', 'main').trim(),
    });

    expect(git(worktree, 'branch', '--show-current').trim()).toBe('build/billing');
    expect(exists(worktree, 'ddd-ts-kit.config.json')).toBe(true);
    // The clean install of the package manager of the project, pnpm by default.
    expect(installers.calls()).toEqual([`pnpm install --frozen-lockfile in ${worktree}`]);
    expect(exists(worktree, 'node_modules')).toBe(true);
  });

  it('leaves the scope file out of git: init ignores .ddd-ts-kit/', () => {
    expect(read(root, '.gitignore')).toContain('.ddd-ts-kit/\n');
    expect(git(worktree, 'status', '--porcelain').trim()).toBe('');
  });

  it('prints the briefing with the context, the project, the worktree, the branch and the trunk filled in', () => {
    const briefing = String(jsonAt(cli(root, 'worker-scope', 'billing', '--json').json(), 'briefing'));

    expect(briefing).toContain('You build the bounded context billing of shop.');
    expect(briefing).toMatch(/^Worktree: \/.*\.worktrees\/billing {3}Branch: build\/billing {3}Trunk: main$/m);

    expect(briefing).toContain(
      '- You may write: src/contexts/billing/**, test/e2e/<use-case>.e2e.spec.ts of your slices (split by behaviour into\n' +
        '  test/e2e/<use-case>-<behaviour>.e2e.spec.ts when one grows long), and their helpers and worlds in\n' +
        '  test/e2e/support/billing/.',
    );

    expect(briefing).toContain('`npx ddd-ts-kit verify-slice billing --since main`');

    expect(briefing).toContain(
      'one by one, never one it leaves out, and commit with the command it prints:\n`feat(billing): <slice in business words>` with the trailer `Slice: <row>`.',
    );
  });

  it('asks the worker to regenerate the derived files with each slice and to keep its report in the worktree', () => {
    const briefing = String(jsonAt(cli(root, 'worker-scope', 'billing', '--json').json(), 'briefing'));

    expect(briefing).toContain('`npx ddd-ts-kit verify-slice billing --since main` (regenerate, the rules');
    expect(briefing).toContain('written by `npm run regenerate`, never by hand.');

    expect(briefing).toContain(
      'Your report is your final message, in the form of the report below; never write a report file.',
    );

    expect(briefing).toContain(
      "Budget: one row is one agent's work, two at most. The guard counts your tool calls and warns you twice,",
    );

    expect(briefing).toContain('you leave and your report are read by `worker-scope --resume`.');
    expect(briefing).toContain('Format with `npm run format`, then `npm run lint:fix`');
    expect(briefing).toContain('never Prettier nor a bare `npx biome`');
    expect(briefing).toContain('Without node_modules: `pnpm install --frozen-lockfile`');
    expect(briefing).toContain('(the whole tree:\n`check --changed-since` sees your files only)');
    expect(briefing).toContain('each marked blocking (a slice cannot be finished');
  });
});

describe('worker-scope, the generators of a worker', () => {
  it('lists the generators that write nothing shared, from what each kind declares', () => {
    const scope = cli(root, 'worker-scope', 'billing', '--json').json();
    const generators = jsonAt(scope, 'generators');

    expect(generators).toEqual([
      'aggregate',
      'builder',
      'test-world',
      'entity',
      'value-object',
      'property (once fast-check is installed)',
      'vocabulary',
      'state-machine',
      'domain-event',
      'error',
      'domain-error',
      'domain-service',
      'command (on an aggregate that has its repository, without --grant)',
      'query (without --grant)',
      'port',
      'route',
      'controller',
      'file-upload (without --grant)',
      'route-group (without --role, or with a role the vocabulary already holds)',
      'guard',
      'representation',
      'form',
      'schema (in its own context: generate schema <context> <Name>)',
      'integration-handler',
      'erasure-handler',
      'event-handler',
      'projection',
      'background-job',
      'process',
      'acl',
      'e2e',
      'adapter (once the project has its first adapter)',
      'adr (without --deviation: a decision of its slices)',
    ]);

    expect(String(jsonAt(scope, 'briefing'))).toContain(
      '- Generators you may run: aggregate, builder, test-world, entity, value-object, property (once fast-check is installed), vocabulary,',
    );
  });
});

describe('worker-scope, on slices, an existing worktree and other places', () => {
  it('asks the worker to bring the trunk in with merge-trunk only, and to resolve each hunk of a stop', () => {
    const briefing = String(jsonAt(cli(root, 'worker-scope', 'billing', '--json').json(), 'briefing'));

    expect(briefing).toContain(
      'To bring the trunk in: `npx ddd-ts-kit merge-trunk --trunk main` only, never `git merge` alone',
    );

    expect(briefing).toContain('`git add` it, then `npx ddd-ts-kit merge-trunk --continue`');
    expect(briefing).toContain('that a change of this branch broke is adapted in this branch');
  });

  it('briefs the first batch of the context still to do, from every table of the file, and names the next', () => {
    const scope = cli(root, 'worker-scope', 'billing', '--json').json();

    expect(jsonAt(scope, 'slices')).toEqual([
      expect.objectContaining({ id: '2', slice: 'Issue invoice', owner: 'billing', status: 'todo' }),
    ]);

    expect(String(jsonAt(scope, 'briefing'))).toContain(
      '- #2 Issue invoice: `generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue`\n',
    );

    expect(String(jsonAt(scope, 'briefing'))).not.toContain('Cancel invoice');

    expect(jsonAt(scope, 'notes')).toContainEqual(
      expect.stringContaining('`npx ddd-ts-kit worker-scope billing --rows 5`'),
    );
  });

  it('keeps the briefing of one row short: its budget included, under 750 words', () => {
    const briefing = String(jsonAt(cli(root, 'worker-scope', 'billing', '--rows', '2', '--json').json(), 'briefing'));

    expect(briefing.split(/\s+/).length).toBeLessThan(750);
  });

  it('keeps a worktree that exists: it only writes the scope again and prints', () => {
    fs.rmSync(path.join(worktree, '.ddd-ts-kit'), { recursive: true });

    const again = cli(root, 'worker-scope', 'billing');

    expect(again.code).toBe(0);
    expect(again.stdout).toContain(`worktree kept: `);
    expect(again.stdout).toContain('You build the bounded context billing of shop.');

    expect(JSON.parse(read(worktree, '.ddd-ts-kit/worker.json'))).toMatchObject({
      context: 'billing',
      base: 'main',
      baseCommit: git(root, 'rev-parse', 'main').trim(),
    });
  });

  it('takes another directory and another branch, and names the upstream contracts', () => {
    const config = 'ddd-ts-kit.config.json';

    write(
      root,
      config,
      read(root, config).replace('"upstreams": []\n    }\n  }', '"upstreams": ["billing"]\n    }\n  }'),
    );

    const scope = cli(
      root,
      'worker-scope',
      'shipping',
      '--worktree',
      '../elsewhere',
      '--branch',
      'feature/shipping',
      '--json',
    ).json();

    expect(git(path.join(path.dirname(root), 'elsewhere'), 'branch', '--show-current').trim()).toBe('feature/shipping');
    expect(scope).toMatchObject({ branch: 'feature/shipping', created: true });

    expect(String(jsonAt(scope, 'briefing'))).toContain(
      'Contracts you consume (read-only): src/contexts/billing/published-language/',
    );
  });

  it('says what to do outside a git repository', () => {
    const plain = path.join(path.dirname(root), 'plain');

    cli(plain, 'init', '--context', 'billing:core');

    const refused = cli(plain, 'worker-scope', 'billing');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('is not inside a git repository.');
  });
});
