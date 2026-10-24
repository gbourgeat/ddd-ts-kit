import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import { project } from './project';

const STRYKER = 'stryker.config.mjs';
const RULE = 'test/mutation-governed';

const GOVERNED = `import { governedMutation } from '@ddd-ts-kit/testing/mutation';

export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutation.config.ts' },
  checkers: [],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  ...governedMutation(),
};
`;

const BY_HAND = GOVERNED.replace(
  '  ...governedMutation(),\n',
  '  ...governedMutation(),\n  thresholds: { break: 10 },\n',
);

const UNGOVERNED = `export default {
  testRunner: 'vitest',
  mutate: ['src/contexts/billing/domain/**/*.ts'],
};
`;

const JSON_BY_HAND = JSON.stringify({ testRunner: 'vitest', mutator: { excludedMutations: ['Regex'] } }, null, 2);

export const MUTATION_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a Stryker config that reads the governed mutation',
    expect: 'pass',
    files: project({ [STRYKER]: GOVERNED }),
  },
  {
    ruleId: RULE,
    name: 'a floor written by hand next to the governed mutation',
    expect: { file: STRYKER },
    files: project({ [STRYKER]: BY_HAND }),
  },
  {
    ruleId: RULE,
    name: 'a Stryker config that mutates what it likes without reading the kit',
    expect: { file: STRYKER },
    files: project({ [STRYKER]: UNGOVERNED }),
  },
  {
    ruleId: RULE,
    name: 'a json Stryker config, which cannot read the kit, leaving a mutation out by hand',
    expect: { file: 'stryker.config.json' },
    files: project({ 'stryker.config.json': JSON_BY_HAND }),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a mutation floor lowered under the reference with its deviation, and one raised freely',
    expect: 'pass',
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          mutation: { domain: 70 },
          deviations: [{ what: 'mutation.domain', adr: '0001', reason: 'The legacy module is retired next quarter.' }],
        }),
      },
    ),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a mutation floor lowered under the reference without a deviation',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ mutation: { domain: 70 }, deviations: [] }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'a mutation floor that is not a percentage, and a layer that is not held to one',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ mutation: { domain: 120, application: 80 }, deviations: [] }) }),
  },
];
