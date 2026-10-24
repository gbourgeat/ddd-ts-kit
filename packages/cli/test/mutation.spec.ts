import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { git } from './support/git';
import { initProject } from './support/init-project';

const REPORT = 'reports/mutation/mutation.json';
const BILLING = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
const SHIPPING = 'src/contexts/shipping/parcels/domain/value-objects/weight.vo.ts';

/** A mutant as the json reporter of Stryker writes it, given by its status alone or with what changed and where. */
type Mutant = string | { status: string; mutatorName: string; line: number; replacement: string };

/** A report as the json reporter of Stryker writes it: the mutants of each file. */
function report(files: Record<string, readonly Mutant[]>): string {
  const entries = Object.entries(files).map(([file, mutants]) => [
    file,
    { language: 'typescript', source: '', mutants: mutants.map((mutant, id) => reported(mutant, id)) },
  ]);

  return JSON.stringify({ schemaVersion: '2', files: Object.fromEntries(entries) });
}

function reported(mutant: Mutant, id: number): Record<string, unknown> {
  if (typeof mutant === 'string') {
    return { id: String(id), status: mutant };
  }

  return {
    id: String(id),
    status: mutant.status,
    mutatorName: mutant.mutatorName,
    replacement: mutant.replacement,
    location: { start: { line: mutant.line, column: 5 }, end: { line: mutant.line, column: 20 } },
  };
}

const UNNOTICED = { status: 'Survived', mutatorName: 'ConditionalExpression', line: 42, replacement: 'true' };
const UNCOVERED = { status: 'NoCoverage', mutatorName: 'StringLiteral', line: 7, replacement: '""' };

let root: string;

beforeAll(() => {
  root = initProject('--context', 'billing:core', '--context', 'shipping:supporting');
});

describe('mutation', () => {
  it('holds every context to the floor of the reference, counting as Stryker does, shows the mutants left out, and exits 0 when all hold', () => {
    write(
      root,
      REPORT,
      report({
        [BILLING]: ['Killed', 'Killed', 'Killed', 'Timeout', 'Survived', 'Ignored'],
        [SHIPPING]: ['Killed', 'RuntimeError'],
      }),
    );

    const held = cli(root, 'mutation');

    expect(held.code).toBe(0);
    expect(held.stdout).toMatch(/^billing\s+domain\s+4\s+1\s+0\s+1\s+80\.0%\s+80%\s+held$/m);
    expect(held.stdout).toMatch(/^shipping\s+domain\s+1\s+0\s+1\s+0\s+100\.0%\s+80%\s+held$/m);
    expect(held.stdout).toContain('Every context holds its mutation floor.');
  });

  it('holds the application layer of a context to its own floor, five below the domain, and leaves any other layer out', () => {
    write(
      root,
      REPORT,
      report({
        [BILLING]: ['Killed', 'Killed'],
        'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts': [
          'Killed',
          'Killed',
          'Killed',
          'Survived',
        ],
        'src/contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts': ['Survived'],
      }),
    );

    const held = cli(root, 'mutation');

    expect(held.code).toBe(0);
    expect(held.stdout).toMatch(/^billing\s+application\s+3\s+1\s+0\s+0\s+75\.0%\s+75%\s+held$/m);
    expect(held.stdout).toMatch(/^billing\s+domain\s+2\s+0\s+0\s+0\s+100\.0%\s+80%\s+held$/m);
    expect(held.stdout).not.toContain('presentation');
  });

  it('exits 1 while a context is under its floor, naming it and what a survivor means', () => {
    write(root, REPORT, report({ [BILLING]: ['Killed', 'Killed', 'Timeout', 'Survived'], [SHIPPING]: ['Killed'] }));

    const under = cli(root, 'mutation');

    expect(under.code).toBe(1);
    expect(under.stdout).toContain('1 layer(s) under the floor: billing (domain).');
    expect(under.stdout).toContain('A survivor is a rule no test states');
  });

  it('counts a mutant no test covers as undetected, and leaves a file outside the contexts out', () => {
    write(
      root,
      REPORT,
      report({ [BILLING]: ['Killed', 'NoCoverage'], 'src/platform/config/read-config.ts': ['Survived', 'Survived'] }),
    );

    const scored = cli(root, 'mutation', '--json');

    expect(scored.code).toBe(1);

    expect(scored.json()).toEqual({
      floor: { domain: 80, application: 75 },
      scores: [
        {
          context: 'billing',
          layer: 'domain',
          detected: 1,
          undetected: 1,
          errors: 0,
          ignored: 0,
          score: 50,
          floor: 80,
          held: false,
        },
      ],
    });
  });

  it('reads the floor the config lowers, with its deviation, and the report named by --report', () => {
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as Record<string, unknown>;

    write(
      root,
      'ddd-ts-kit.config.json',
      JSON.stringify({
        ...config,
        mutation: { domain: 50 },
        deviations: [{ what: 'mutation.domain', adr: '0001', reason: 'The legacy module is retired next quarter.' }],
      }),
    );

    write(root, 'reports/night.json', report({ [BILLING]: ['Killed', 'Survived'] }));

    const held = cli(root, 'mutation', '--report', 'reports/night.json');

    expect(held.code).toBe(0);
    expect(held.stdout).toMatch(/^billing\s+domain\s+1\s+1\s+0\s+0\s+50\.0%\s+50%\s+held$/m);
  });
});

describe('mutation, the survivors it lists', () => {
  it('lists the survivors on request, where, what mutator and what the code became, a line no test covers said so', () => {
    write(
      root,
      REPORT,
      report({ [BILLING]: [...Array<string>(8).fill('Killed'), UNNOTICED, UNCOVERED], [SHIPPING]: ['Killed'] }),
    );

    const listed = cli(root, 'mutation', '--survivors');

    expect(listed.code).toBe(0);
    expect(listed.stdout).toContain('Survivors (2):');
    expect(listed.stdout).toContain(`  ${BILLING}:7  StringLiteral (no test covers the line)  ""`);
    expect(listed.stdout).toContain(`  ${BILLING}:42  ConditionalExpression  true`);
    expect(cli(root, 'mutation').stdout).not.toContain('Survivors');
  });

  it('lists the survivors of the files changed since a git ref alone, and exits 0 whatever the scores', () => {
    git(root, 'init', '-q');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'the project');
    write(root, BILLING, 'export class Invoice {}\n');
    write(root, REPORT, report({ [BILLING]: ['Killed', UNNOTICED], [SHIPPING]: ['Killed', 'Survived', 'Survived'] }));

    const changed = cli(root, 'mutation', '--changed', 'HEAD');

    expect(changed.code).toBe(0);
    expect(changed.stdout).toMatch(/^shipping\s+domain\s+1\s+2\s+0\s+0\s+33\.3%\s+\d+%\s+under the floor$/m);
    expect(changed.stdout).toContain('Survivors in the files changed since HEAD (1):');
    expect(changed.stdout).toContain(`  ${BILLING}:42  ConditionalExpression  true`);
    expect(changed.stdout).not.toContain(SHIPPING);

    expect(cli(root, 'mutation', '--changed', 'HEAD', '--json').json()).toMatchObject({
      survivors: [
        { context: 'billing', file: BILLING, line: 42, mutator: 'ConditionalExpression', status: 'Survived' },
      ],
    });
  });

  it('reads the base of a change from the environment, as the job of a pull request sets it', () => {
    process.env['DDD_TS_KIT_MUTATION_SINCE'] = 'HEAD';

    try {
      const changed = cli(root, 'mutation');

      expect(changed.code).toBe(0);
      expect(changed.stdout).toContain('Survivors in the files changed since HEAD (1):');
    } finally {
      delete process.env['DDD_TS_KIT_MUTATION_SINCE'];
    }
  });

  it('refuses a ref git does not know', () => {
    const unknown = cli(root, 'mutation', '--changed', 'no-such-ref');

    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('The files changed since no-such-ref cannot be listed.');
  });

  it('asks for a run when no report exists', () => {
    const bare = initProject('--context', 'billing:core');

    const missing = cli(bare, 'mutation');

    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain(`No mutation report at ${REPORT}.`);
    expect(missing.stderr).toContain('npm run test:mutation');
  });
});
