import { describe, expect, it } from 'vitest';
import { parseConfig, REFERENCE_COVERAGE, serializeConfig } from '../src/config/index.js';
import { changeConfig, checkJsonOf } from './check-support.js';
import { cli, read, REPO_ROOT, tempDir, write } from './helpers.js';

describe('the coverage thresholds of the config', () => {
  it('are the reference when the config says nothing, and are not written to the file then', () => {
    const config = parseConfig({});

    expect(config.coverage).toEqual(REFERENCE_COVERAGE);
    expect(serializeConfig(config)).not.toContain('"coverage"');
  });

  it('are read rate by rate over the reference, and written once one departs from it', () => {
    const config = parseConfig({
      coverage: { domain: { branches: 95 }, infrastructure: { lines: 150, statements: '70' } },
    });

    expect(config.coverage).toEqual({ ...REFERENCE_COVERAGE, domain: { ...REFERENCE_COVERAGE.domain, branches: 95 } });
    expect(parseConfig(JSON.parse(serializeConfig(config))).coverage).toEqual(config.coverage);
  });

  it('have one reference: the one the test runner applies is the one the checker reads a lowered threshold against', () => {
    expect(runnerReference()).toEqual(REFERENCE_COVERAGE);
  });

  it('are free to raise, and need a decision record to lower', () => {
    const root = tempDir('coverage-config');

    cli(root, 'init');
    changeConfig(root, { coverage: { domain: { lines: 100 }, infrastructure: { branches: 40 } } });

    const lowered = checkJsonOf(cli(root, 'check', '--json')).violations.map(
      ({ ruleId, message }) => `${ruleId}: ${message}`,
    );

    expect(lowered).toEqual([
      'governance/recorded-deviation: The coverage threshold "infrastructure.branches" is 40, below the reference of 60, and no deviation records why.',
    ]);

    write(root, 'docs/adr/0002-driver-branches.md', '# Decision\n');

    changeConfig(root, {
      deviations: [{ what: 'coverage.infrastructure.branches', adr: '0002', reason: 'Held by the contract suite.' }],
    });

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
    expect(read(root, 'ddd-ts-kit.config.json')).toContain('"branches": 40');
  });

  it('are percentages: check says what is read instead of a rate that is not one', () => {
    const root = tempDir('coverage-config');

    cli(root, 'init');
    changeConfig(root, { coverage: { domain: { lines: 120 }, shared: { lines: 80 }, application: { paths: 80 } } });

    expect(
      checkJsonOf(cli(root, 'check', '--json')).violations.map(({ ruleId, message }) => `${ruleId}: ${message}`),
    ).toEqual([
      'config/valid: "coverage.domain.lines" is 120: it is read as 90.',
      'config/valid: "coverage.shared" is not a measured layer: it is ignored.',
      'config/valid: "coverage.application.paths" is not a rate: it is ignored.',
    ]);
  });
});

/** The reference the test runner applies, read from the source of `@ddd-ts-kit/testing`, which the CLI does not depend on. */
function runnerReference(): unknown {
  const source = read(REPO_ROOT, 'packages/testing/src/coverage/reference-coverage.ts');
  const literal = /REFERENCE_COVERAGE = (\{[\s\S]*?\n\}) as const/.exec(source)?.[1] ?? '';

  return JSON.parse(literal.replaceAll(/(\w+):/g, '"$1":').replaceAll(/,(\s*\})/g, '$1'));
}
