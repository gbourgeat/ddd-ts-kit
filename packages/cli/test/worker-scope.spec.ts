import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` | | conductor | done |
| 2 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\` | 1 | billing | todo |
| 3 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --permission invoice.cancel\` | 1 | billing | done |
| 4 | shipping | slice | Ship | \`generate command shipping Ship --public\` | | shipping | todo |
`;

let root: string;
let worktree: string;

beforeAll(() => {
  root = committedProject('shop', '--context', 'billing:core', '--context', 'shipping:supporting');
  worktree = fs.realpathSync(path.dirname(root)) + path.sep + 'shop-billing';
  write(root, 'docs/architecture/slices.md', SLICES);
});

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

  it('creates the worktree next to the project, on the branch build/<context>, with the scope of the worker', () => {
    const scope = cli(root, 'worker-scope', 'billing', '--json');

    expect(scope.code).toBe(0);
    expect(fs.realpathSync(String(jsonAt(scope.json(), 'worktree')))).toBe(worktree);

    expect(scope.json()).toMatchObject({
      created: true,
      branch: 'build/billing',
      trunk: 'main',
      scopeFile: path.join(String(jsonAt(scope.json(), 'root')), '.ddd-ts-kit/worker.json'),
    });

    expect(JSON.parse(read(worktree, '.ddd-ts-kit/worker.json'))).toEqual({ context: 'billing' });
    expect(git(worktree, 'branch', '--show-current').trim()).toBe('build/billing');
    expect(exists(worktree, 'ddd-ts-kit.config.json')).toBe(true);
  });

  it('leaves the scope file out of git: init ignores .ddd-ts-kit/', () => {
    expect(read(root, '.gitignore')).toContain('.ddd-ts-kit/\n');
    expect(git(worktree, 'status', '--porcelain').trim()).toBe('');
  });

  it('prints the briefing with the context, the project, the worktree, the branch and the trunk filled in', () => {
    const briefing = String(jsonAt(cli(root, 'worker-scope', 'billing', '--json').json(), 'briefing'));

    expect(briefing).toContain('You build the bounded context billing of shop.');
    expect(briefing).toMatch(/^Worktree: \/.*shop-billing {3}Branch: build\/billing {3}Trunk: main$/m);

    expect(briefing).toContain(
      '- You may write: src/contexts/billing/** and test/e2e/<use-case>.e2e.spec.ts of your slices.',
    );

    expect(briefing).toContain('`npx ddd-ts-kit check --changed-since main`');
    expect(briefing).toContain('commit: `feat(billing): <slice in business words>`.');
  });

  it('lists the generators that write nothing shared, from what each kind declares', () => {
    const scope = cli(root, 'worker-scope', 'billing', '--json').json();
    const generators = jsonAt(scope, 'generators');

    expect(generators).toEqual([
      'aggregate',
      'builder',
      'entity',
      'value-object',
      'vocabulary',
      'domain-event',
      'error',
      'domain-error',
      'domain-service',
      'command (on an aggregate that has its repository)',
      'query',
      'port',
      'route',
      'controller',
      'route-group (without --role, or with a role the vocabulary already holds)',
      'guard',
      'integration-handler',
      'event-handler',
      'projection',
      'acl',
      'e2e',
      'adapter (once the project has its first adapter)',
    ]);

    expect(String(jsonAt(scope, 'briefing'))).toContain(
      '- Generators you may run: aggregate, builder, entity, value-object, vocabulary, domain-event',
    );
  });
});

describe('worker-scope, on slices, an existing worktree and other places', () => {
  it('lists the slices of the context that are still to do', () => {
    const scope = cli(root, 'worker-scope', 'billing', '--json').json();

    expect(jsonAt(scope, 'slices')).toEqual([
      expect.objectContaining({ id: '2', slice: 'Issue invoice', owner: 'billing', status: 'todo' }),
    ]);

    expect(String(jsonAt(scope, 'briefing'))).toContain(
      '- #2 Issue invoice: `generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue` ; rules: <invariants and failures by name>',
    );

    expect(String(jsonAt(scope, 'briefing'))).not.toContain('Cancel invoice');
  });

  it('keeps a worktree that exists: it only writes the scope again and prints', () => {
    fs.rmSync(path.join(worktree, '.ddd-ts-kit'), { recursive: true });

    const again = cli(root, 'worker-scope', 'billing');

    expect(again.code).toBe(0);
    expect(again.stdout).toContain(`worktree kept: `);
    expect(again.stdout).toContain('You build the bounded context billing of shop.');
    expect(JSON.parse(read(worktree, '.ddd-ts-kit/worker.json'))).toEqual({ context: 'billing' });
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
