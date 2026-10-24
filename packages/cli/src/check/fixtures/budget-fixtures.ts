import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import { project } from './project';

export const BUDGET_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a time budget raised above the reference with its deviation, and one lowered freely',
    expect: 'pass',
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          budget: { unit: 8000, integration: 20_000 },
          deviations: [
            { what: 'budget.unit', adr: '0001', reason: 'The pricing engine loads a table of rates per spec.' },
          ],
        }),
      },
    ),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a time budget raised above the reference without a deviation',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ budget: { unit: 8000 }, deviations: [] }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'a time budget that is no duration, and a level that is not held to one',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ budget: { unit: 'fast', e2e: 60_000 }, deviations: [] }) }),
  },
];
