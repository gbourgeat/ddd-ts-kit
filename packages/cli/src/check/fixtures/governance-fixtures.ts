import { CONFIG_FILE } from '../../config/index.js';
import { aggregate } from './aggregate.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { ADAPTER, AGGREGATE } = PATHS;
const { RECORD } = SAMPLES;

export const GOVERNANCE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'governance/recorded-deviation',
    name: 'suppressions and relaxed settings that point to an existing decision record',
    expect: 'pass',
    files: project(
      {
        ...aggregate(
          "import Decimal from 'decimal.js';\nexport class Invoice {\n  readonly total = new Decimal(0);\n  // ddd-ts-kit-disable-next-line purity/no-system-clock -- ADR-0007: the legacy import stamps invoices itself\n  readonly importedAt = new Date();\n}\n",
        ),
        [ADAPTER]: '/* eslint-disable no-console -- see docs/adr/0007-legacy-import.md */\nexport class InMemoryInvoiceRepository {}\n',
        'docs/adr/0007-legacy-import.md': RECORD,
      },
      {
        [CONFIG_FILE]: config({
          rules: { 'test/builder-required': 'off', 'naming/suffix': 'warn', 'test/no-mocks': 'error' },
          guard: 'advise',
          domainAllowedPackages: ['@ddd-ts-kit/kernel', 'decimal.js'],
          deviations: [
            { what: 'rules.test/builder-required', adr: 'ADR-0007', reason: 'Aggregates of the legacy import are built by the import itself.' },
            { what: 'rules.naming/suffix', adr: '7', reason: 'Legacy files keep their names until the import is retired.' },
            { what: 'guard', adr: '0007', reason: 'The import is written by a tool the hook cannot stop.' },
            { what: 'domainAllowedPackages.decimal.js', adr: 'docs/adr/0007-legacy-import.md', reason: 'Money arithmetic of the legacy import.' },
          ],
        }),
      },
    ),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a suppression with a reason and no decision record still silences its rule',
    expect: { file: AGGREGATE },
    files: project(aggregate("// ddd-ts-kit-disable-next-line layer/domain-purity -- decimal.js is our money arithmetic\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n")),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a suppression pointing to a record that does not exist',
    expect: { file: AGGREGATE },
    files: project(aggregate("// ddd-ts-kit-disable-next-line layer/domain-purity -- ADR-0099: decimal.js is our money arithmetic\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n")),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a lint suppression with a reason and no decision record',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: '// eslint-disable-next-line no-console -- startup banner requested by operations\nexport class InMemoryInvoiceRepository {}\n' }),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a rule switched off without a deviation',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ rules: { 'test/spec-required': 'off' }, deviations: [] }) }),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a package, a directory and a guard mode added without a deviation',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          guard: 'advise',
          applicationAllowedPackages: ['@ddd-ts-kit/kernel', 'lodash'],
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'], extraDirectories: ['infrastructure/messaging'] },
            catalog: { classification: 'supporting', upstreams: [] },
          },
          deviations: [],
        }),
      },
    ),
  },
  {
    ruleId: 'governance/recorded-deviation',
    name: 'a deviation without a reason, pointing to a missing record',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ guard: 'advise', deviations: [{ what: 'guard', adr: 'ADR-0042', reason: '' }] }) }),
  },
];
