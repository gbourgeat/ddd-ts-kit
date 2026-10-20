import { beforeAll, describe, expect, it } from 'vitest';
import { RULE_DOCS } from '../src/check/explain/rule-docs.js';
import { AGGREGATE, changeConfig, checkJsonOf, errorFixOf, HANDLER, isRecord } from './check-support.js';
import { cli, read, scaffoldEverything, tempDir, write, type CliResult } from './helpers.js';
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

  it('names how an aggregate past the size limit moves a decision out', () => {
    const long = projectWithImpureAggregate('check-aggregate-size');
    const padding = Array.from({ length: 360 }, (_, line) => `export const line${line} = ${line};`).join('\n');

    write(long, AGGREGATE, `${read(long, AGGREGATE)}\n${padding}\n`);
    write(long, HANDLER, `${read(long, HANDLER)}\n${padding}\n`);

    const fixes = checkJsonOf(cli(long, 'check', '--rule', 'clean/file-size', '--json')).violations.map((violation) => [
      violation.file,
      violation.fix,
    ]);

    expect(fixes).toContainEqual([AGGREGATE, expect.stringContaining('returns the new state and its events')]);
    expect(fixes).toContainEqual([HANDLER, expect.stringContaining('Split it by responsibility')]);
  });

  it('names how an end-to-end spec past the size limit splits into parts named after it', () => {
    const long = projectWithImpureAggregate('check-e2e-size');
    const spec = 'test/e2e/issue-invoice.e2e.spec.ts';
    const padding = Array.from({ length: 360 }, (_, line) => `export const line${line} = ${line};`).join('\n');

    write(long, spec, `${padding}\n`);

    const fixes = checkJsonOf(cli(long, 'check', '--rule', 'clean/file-size', '--json')).violations.map((violation) => [
      violation.file,
      violation.fix,
    ]);

    expect(fixes).toContainEqual([spec, expect.stringContaining('test/e2e/<use-case>-<behaviour>.e2e.spec.ts')]);
    expect(fixes).toContainEqual([spec, expect.stringContaining('test/e2e/support/<context>/')]);
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

describe('check --explain', () => {
  const PURITY = ['--rule', 'layer/domain-purity'];
  const why = RULE_DOCS['layer/domain-purity']?.why ?? '';
  let root: string;

  beforeAll(() => {
    root = projectWithImpureAggregate('check-explain');

    write(
      root,
      'src/contexts/billing/domain/services/pricing.service.ts',
      "import { z } from 'zod';\n\nexport const pricing = z;\n",
    );
  });

  it('follows the violations with the reason of each rule, once for a rule reported twice', () => {
    const { stdout } = cli(root, 'check', ...PURITY, '--explain');

    expect(stdout.match(/ {2}error {2}layer\/domain-purity\n/g)).toHaveLength(2);
    expect(stdout.split('\n').filter((line) => line === 'layer/domain-purity')).toHaveLength(1);
    expect(stdout).toContain(`\n  why: ${why}\n\n2 errors, 0 warnings`);
  });

  it('adds the explanations to the json report, and none without a violation', () => {
    const explained = cli(root, 'check', ...PURITY, '--explain', '--json').json();
    const elsewhere = cli(root, 'check', 'src/contexts/shipping', ...PURITY, '--explain', '--json').json();

    expect(explained).toMatchObject({ errors: 2, explanations: [{ id: 'layer/domain-purity', why }] });
    expect(elsewhere).toMatchObject({ errors: 0, explanations: [] });
    expect(cli(root, 'check', 'src/contexts/shipping', ...PURITY, '--explain').stdout).not.toContain('why:');
    expect(cli(root, 'check', ...PURITY, '--json').json()).not.toHaveProperty('explanations');
  });

  it('gives the reason in each annotation of github and gitlab, with the same fingerprints', () => {
    const annotations = cli(root, 'check', ...PURITY, '--explain', '--format', 'github').stdout.split('\n');
    const explained = issuesOf(cli(root, 'check', ...PURITY, '--explain', '--format', 'gitlab'));
    const plain = issuesOf(cli(root, 'check', ...PURITY, '--format', 'gitlab'));

    expect(annotations.filter((line) => line.startsWith('::error file=') && line.includes(' Why: '))).toHaveLength(2);

    expect(explained.map(descriptionOf)).toEqual([
      expect.stringContaining(` Why: ${why}`),
      expect.stringContaining(` Why: ${why}`),
    ]);

    expect(explained.map(fingerprintOf)).toEqual(plain.map(fingerprintOf));
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

function issuesOf(result: CliResult): unknown[] {
  const parsed = result.json();

  return Array.isArray(parsed) ? parsed : [];
}

function descriptionOf(issue: unknown): unknown {
  return isRecord(issue) ? issue['description'] : undefined;
}

function fingerprintOf(issue: unknown): unknown {
  return isRecord(issue) ? issue['fingerprint'] : undefined;
}

function ruleIdsOf(root: string): string[] {
  return checkJsonOf(cli(root, 'check', ...SUPPRESSIBLE, '--json')).violations.map((violation) => violation.ruleId);
}
