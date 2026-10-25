import { describe, expect, it } from 'vitest';
import { AGGREGATE, checkJsonOf } from './check-support';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers';
import { readJson } from './support/read-json';

const BASELINE = 'ddd-ts-kit-baseline.json';

describe('check --baseline', () => {
  it('records the errors a project already has, and check reports none of them', () => {
    const root = legacyProject('baseline-write');

    expect(cli(root, 'check').code).toBe(1);

    const written = cli(root, 'check', '--baseline', 'write');

    expect(written.code).toBe(0);
    expect(written.stdout).toContain(`${BASELINE}: 1 error recorded in 1 file.`);
    expect(readJson(root, BASELINE)).toEqual({ [AGGREGATE]: { 'layer/domain-purity': { count: 1 } } });
    expect(checkJsonOf(cli(root, 'check', '--json'))).toMatchObject({ ok: true, errors: 0 });
  });

  it('reports every error of a rule in a file once there are more than the baseline records', () => {
    const root = legacyProject('baseline-more');

    cli(root, 'check', '--baseline', 'write');
    write(root, AGGREGATE, `import express from 'express';\n${read(root, AGGREGATE)}\nexport const app = express;\n`);

    const json = checkJsonOf(cli(root, 'check', '--json'));

    expect(json.errors).toBe(2);

    expect(json.violations.map((violation) => violation.ruleId)).toEqual([
      'layer/domain-purity',
      'layer/domain-purity',
    ]);
  });

  it('fails once a recorded count is no longer reached, until prune lowers it', () => {
    const root = legacyProject('baseline-prune');
    const legacy = read(root, AGGREGATE);

    cli(root, 'check', '--baseline', 'write');

    write(
      root,
      AGGREGATE,
      legacy.replace("import { z } from 'zod';\n", '').replace('\nexport const shape = z;\n', '\n'),
    );

    const stale = cli(root, 'check');

    expect(stale.code).toBe(1);

    expect(stale.stdout).toContain(
      `${BASELINE} records 1 error of layer/domain-purity in this file, and the file has 0: the baseline only shrinks.`,
    );

    expect(cli(root, 'check', '--baseline', 'prune').stdout).toContain(`${BASELINE}: 0 errors recorded in 0 files.`);
    expect(readJson(root, BASELINE)).toEqual({});
    expect(cli(root, 'check').code).toBe(0);
  });

  it('keeps the errors it records quiet in the check of one written file, the hook of the agent included', () => {
    const root = legacyProject('baseline-file');

    expect(cli(root, 'check-file', AGGREGATE).code).toBe(1);

    cli(root, 'check', '--baseline', 'write');

    expect(cli(root, 'check-file', AGGREGATE).code).toBe(0);
  });

  it('records only from a run of every rule on every file', () => {
    const root = legacyProject('baseline-partial');

    const refused = cli(root, 'check', '--baseline', 'write', '--rule', 'layer/domain-purity');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('--baseline write judges every rule on every file.');
    expect(cli(root, 'check', '--baseline', 'keep').stderr).toContain('Use --baseline write or --baseline prune.');
  });
});

/** A generated project whose aggregate imports a validation library: one error of the domain, as code written before the kit would hold. */
function legacyProject(label: string): string {
  const root = tempDir(label);

  scaffoldEverything(root);
  write(root, AGGREGATE, `import { z } from 'zod';\n${read(root, AGGREGATE)}\nexport const shape = z;\n`);

  return root;
}
