import { CONFIG_FILE } from '../../config/index.js';
import { aggregate } from './aggregate.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { AGGREGATE, AGGREGATE_SPEC, BUILDER } = PATHS;
const { RECORD, SPEC } = SAMPLES;

const RUNNER = 'vitest.config.ts';
const RULE = 'test/coverage-governed';
const TESTED = { [AGGREGATE_SPEC]: SPEC, [BUILDER]: 'export const anInvoice = 1;\n' };

const GOVERNED = `import { defineConfig } from 'vitest/config';
import { governedCoverage } from '@ddd-ts-kit/testing/coverage';

export default defineConfig(({ mode }) => ({
  ssr: { resolve: { conditions: ['ddd-ts-kit-source'] } },
  test: {
    exclude: ['src/contexts/*/test/integration/**'],
    coverage: { provider: 'v8', reporter: ['text'], ...governedCoverage(mode) },
  },
}));
`;

const BY_HAND = GOVERNED.replace(
  '...governedCoverage(mode) }',
  "...governedCoverage(mode), exclude: ['src/contexts/billing/domain/**'] }",
);

const UNGOVERNED = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: { resolve: { conditions: ['ddd-ts-kit-source'] } },
  test: { coverage: { provider: 'v8', thresholds: { lines: 10 } } },
});
`;

/** A manifest that declares no alias: the alias rule has its say on it too. */
const FLAGGED = JSON.stringify(
  { scripts: { 'test:coverage': "vitest run --coverage --coverage.exclude='src/contexts/billing/**'" } },
  null,
  2,
);

const HIDDEN = 'export class Invoice {\n  /* v8 ignore next 3 */\n  void(): void {\n    this.voided = true;\n  }\n}\n';
const RECORDED = HIDDEN.replace('next 3 */', 'next 3 -- ADR-0007: reached only by the legacy import */');
const LOWERED = { coverage: { domain: { branches: 60 } } };

export const COVERAGE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a runner config that reads the governed coverage, and an ignore comment with its decision record',
    expect: 'pass',
    files: project({ ...aggregate(RECORDED), ...TESTED, [RUNNER]: GOVERNED, 'docs/adr/0007-legacy-import.md': RECORD }),
  },
  {
    ruleId: RULE,
    name: 'an exclude written by hand next to the governed coverage',
    expect: { file: RUNNER },
    files: project({ [RUNNER]: BY_HAND }),
  },
  {
    ruleId: RULE,
    name: 'a runner config with thresholds of its own',
    expect: { file: RUNNER },
    files: project({ [RUNNER]: UNGOVERNED }),
  },
  {
    ruleId: RULE,
    name: 'a script that excludes files from the measure by a flag',
    expect: { file: 'package.json' },
    also: ['imports/alias-declared'],
    files: project({ [RUNNER]: GOVERNED, 'package.json': FLAGGED }),
  },
  {
    ruleId: RULE,
    name: 'an ignore comment in a production source without a decision record',
    expect: { file: AGGREGATE },
    files: project({ ...aggregate(HIDDEN), ...TESTED }),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a coverage threshold lowered under the reference with its deviation, and one raised freely',
    expect: 'pass',
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          coverage: { ...LOWERED.coverage, application: { lines: 95 } },
          deviations: [
            { what: 'coverage.domain.branches', adr: '0001', reason: 'The legacy import is retired next quarter.' },
          ],
        }),
      },
    ),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a coverage threshold lowered under the reference without a deviation',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ ...LOWERED, deviations: [] }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'a coverage threshold that is not a percentage, and a layer that is not measured',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      { [CONFIG_FILE]: config({ coverage: { domain: { lines: 120 }, shared: { lines: 80 } }, deviations: [] }) },
    ),
  },
];
