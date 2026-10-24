import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';

const REPORT = 'reports/mutation/mutation.json';
const BILLING = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
const SHIPPING = 'src/contexts/shipping/parcels/domain/value-objects/weight.vo.ts';

/** A report as the json reporter of Stryker writes it: the mutants of each file, by status. */
function report(files: Record<string, readonly string[]>): string {
  const entries = Object.entries(files).map(([file, statuses]) => [
    file,
    { language: 'typescript', source: '', mutants: statuses.map((status, id) => ({ id: String(id), status })) },
  ]);

  return JSON.stringify({ schemaVersion: '2', files: Object.fromEntries(entries) });
}

describe('mutation', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core', '--context', 'shipping:supporting');
  });

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
    expect(held.stdout).toMatch(/^billing\s+4\s+1\s+0\s+1\s+80\.0%\s+80%\s+held$/m);
    expect(held.stdout).toMatch(/^shipping\s+1\s+0\s+1\s+0\s+100\.0%\s+80%\s+held$/m);
    expect(held.stdout).toContain('Every context holds its mutation floor.');
  });

  it('exits 1 while a context is under its floor, naming it and what a survivor means', () => {
    write(root, REPORT, report({ [BILLING]: ['Killed', 'Killed', 'Timeout', 'Survived'], [SHIPPING]: ['Killed'] }));

    const under = cli(root, 'mutation');

    expect(under.code).toBe(1);
    expect(under.stdout).toContain('1 context(s) under the floor: billing.');
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
      floor: { domain: 80 },
      scores: [
        { context: 'billing', detected: 1, undetected: 1, errors: 0, ignored: 0, score: 50, floor: 80, held: false },
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
    expect(held.stdout).toMatch(/^billing\s+1\s+1\s+0\s+0\s+50\.0%\s+50%\s+held$/m);
  });

  it('asks for a run when no report exists', () => {
    const bare = initProject('--context', 'billing:core');

    const missing = cli(bare, 'mutation');

    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain(`No mutation report at ${REPORT}.`);
    expect(missing.stderr).toContain('npm run test:mutation');
  });
});
