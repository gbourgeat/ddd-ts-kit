import { beforeAll, describe, expect, it } from 'vitest';
import { AGGREGATE, changeConfig, checkJsonOf, errorFixOf, HANDLER } from './check-support.js';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';

const ADR = '# The amount schema is shared with the route until it moves\n';
/** The rules these tests break on purpose: what else the generated project holds is judged by the generator's own tests. */
const LAYERS = ['--rule', 'layer/domain-purity', '--rule', 'layer/application-inward'];

const SUPPRESSIBLE = [
  ...LAYERS,
  '--rule',
  'config/suppression-needs-reason',
  '--rule',
  'governance/recorded-deviation',
];

describe('check', () => {
  let root: string;

  beforeAll(() => {
    root = projectWithImpureAggregate('check');
    write(root, HANDLER, `import express from 'express';\n${read(root, HANDLER)}\nexport const app = express;\n`);
  });

  it('reports each violation with its rule, place and fix, and exits 1', () => {
    const result = cli(root, 'check', ...LAYERS);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain(`${AGGREGATE}:1  error  layer/domain-purity`);
    expect(result.stdout).toContain('  fix: Remove the import');
    expect(result.stdout).toContain(`${HANDLER}:1  error  layer/application-inward`);
    expect(result.stdout).toMatch(/2 errors, 0 warnings, 0 suppressions in \d+ files\./);
  });

  it('prints machine-readable violations with --json or --format json', () => {
    const json = checkJsonOf(cli(root, 'check', ...LAYERS, '--json'));

    expect(json).toMatchObject({ ok: false, errors: 2, warnings: 0 });

    expect(json.violations.map((violation) => violation.ruleId)).toEqual([
      'layer/application-inward',
      'layer/domain-purity',
    ]);

    expect(json.violations.every((violation) => violation.fix.length > 20)).toBe(true);
    expect(cli(root, 'check', ...LAYERS, '--format', 'json').json()).toEqual(json);
  });

  it('prints GitHub annotations with --format github', () => {
    const { stdout } = cli(root, 'check', ...LAYERS, '--format', 'github');

    expect(stdout).toContain(
      `::error file=${AGGREGATE},line=1,title=layer/domain-purity::The domain imports the package "zod".`,
    );

    expect(stdout.split('\n').filter((line) => line.startsWith('::error file='))).toHaveLength(2);
  });

  it('limits the rules with --rule and the files with paths', () => {
    const byRule = checkJsonOf(cli(root, 'check', '--rule', 'layer/domain-purity', '--json'));
    const byPath = checkJsonOf(cli(root, 'check', 'src/contexts/billing/application', ...LAYERS, '--json'));
    const elsewhere = cli(root, 'check', 'src/contexts/shipping', ...LAYERS, '--json');

    expect(byRule.violations.map((violation) => violation.file)).toEqual([AGGREGATE]);
    expect(byPath.violations.map((violation) => violation.file)).toEqual([HANDLER]);
    expect(elsewhere.code).toBe(0);
  });

  it('refuses an unknown rule, an unknown format and a ref git cannot resolve', () => {
    const noGit = cli(root, 'check', '--changed-since', 'main', '--json');

    expect(cli(root, 'check', '--rule', 'layer/unknown').code).toBe(2);
    expect(cli(root, 'check', '--format', 'xml').code).toBe(2);
    expect(noGit.code).toBe(2);
    expect(errorFixOf(noGit)).toContain('git repository');
  });

  it('judges with --changed-since the files changed since the ref, a new file not added to git included', () => {
    const repository = committedProject('changed-since', '--context', 'billing:core');
    const fresh = 'src/contexts/billing/domain/services/pricing.service.ts';

    git(repository, 'switch', '--quiet', '--create', 'build/billing');
    write(repository, fresh, "import { z } from 'zod';\n\nexport const pricing = z;\n");

    const judged = checkJsonOf(cli(repository, 'check', '--changed-since', 'main', ...LAYERS, '--json'));

    expect(judged.violations.map((violation) => violation.file)).toEqual([fresh]);
  });

  it('finds the project root from a sub-directory', () => {
    expect(cli(`${root}/src/contexts/billing`, 'check', ...LAYERS, '--json').json()).toMatchObject({ errors: 2 });
  });

  it('fails with a fix when there is no config', () => {
    const result = cli(tempDir('empty'), 'check', '--json');

    expect(result.code).toBe(2);
    expect(errorFixOf(result)).toContain('ddd-ts-kit init');
  });
});

describe('check and the config', () => {
  it('applies the severities of the config: warn does not fail, off does not run', () => {
    const root = projectWithImpureAggregate('check-severity');

    const deviations = [
      {
        what: 'rules.layer/domain-purity',
        adr: '0002',
        reason: 'The amount schema is shared with the route until it moves.',
      },
    ];

    write(root, 'docs/adr/0002-shared-amount-schema.md', ADR);
    changeConfig(root, { rules: { 'layer/domain-purity': 'warn' }, deviations });

    const warned = cli(root, 'check', ...LAYERS, '--json');

    expect(warned.code).toBe(0);
    expect(warned.json()).toMatchObject({ ok: true, errors: 0, warnings: 1 });
    expect(cli(root, 'check', ...LAYERS, '--format', 'github').stdout).toContain('::warning file=');

    changeConfig(root, { rules: { 'layer/domain-purity': 'off' }, deviations });

    expect(cli(root, 'check', ...LAYERS, '--json').json()).toMatchObject({ errors: 0, warnings: 0 });
  });

  it('counts a suppression and honours it when its reason points to a decision record', () => {
    const root = projectWithImpureAggregate('check-suppress');
    const source = read(root, AGGREGATE);

    write(root, 'docs/adr/0003-shared-amount-schema.md', ADR);

    write(
      root,
      AGGREGATE,
      `// ddd-ts-kit-disable-next-line layer/domain-purity -- ADR-0003: the amount schema is shared with the route until it moves\n${source}`,
    );

    const justified = cli(root, 'check', ...SUPPRESSIBLE);

    expect(justified.code).toBe(0);
    expect(justified.stdout).toContain('0 errors, 0 warnings, 1 suppression in');
    expect(cli(root, 'check', ...SUPPRESSIBLE, '--json').json()).toMatchObject({ suppressions: 1, suppressed: 1 });
  });

  it('reports a suppression without a reason, without a record or of another rule', () => {
    const root = projectWithImpureAggregate('check-unjustified');
    const source = read(root, AGGREGATE);

    const suppress = (comment: string): void => {
      write(root, AGGREGATE, `// ddd-ts-kit-disable-next-line ${comment}\n${source}`);
    };

    write(root, 'docs/adr/0003-shared-amount-schema.md', ADR);
    suppress('layer/domain-purity');

    expect(ruleIdsOf(root)).toEqual(['config/suppression-needs-reason', 'layer/domain-purity']);

    suppress('layer/domain-purity -- the amount schema is shared with the route until it moves');

    expect(ruleIdsOf(root)).toEqual(['governance/recorded-deviation']);

    suppress('layer/application-inward -- ADR-0003: wrong rule');

    expect(ruleIdsOf(root)).toEqual(['layer/domain-purity']);
  });
});

describe('check --self', () => {
  it('replays the rule fixtures and exits 0', () => {
    const result = cli(tempDir('self'), 'check', '--self');

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/(\d+)\/\1 rule fixtures behave as expected\./);
    expect(result.stdout).not.toContain('FAIL');
  });
});

/** A scaffolded project whose invoice aggregate imports a schema library. */
function projectWithImpureAggregate(label: string): string {
  const root = tempDir(label);

  scaffoldEverything(root);
  write(root, AGGREGATE, `import { z } from 'zod';\n${read(root, AGGREGATE)}\nexport const shape = z;\n`);

  return root;
}

function ruleIdsOf(root: string): string[] {
  return checkJsonOf(cli(root, 'check', ...SUPPRESSIBLE, '--json')).violations.map((violation) => violation.ruleId);
}
