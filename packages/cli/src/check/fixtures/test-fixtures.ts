import { CONFIG_FILE } from '../../config/index.js';
import { aggregate } from './aggregate.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { AGGREGATE, AGGREGATE_SPEC, BILLING, BUILDER, CATALOG, HANDLER, HANDLER_SPEC } = PATHS;
const { SPEC } = SAMPLES;

export const TEST_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'test/spec-required',
    name: 'a spec found by base name anywhere under test/',
    expect: 'pass',
    files: project({
      [AGGREGATE]: 'export class Invoice {}\n',
      [BUILDER]: 'export const anInvoice = 1;\n',
      [`${BILLING}/test/unit/domain/invoice.aggregate.spec.ts`]: SPEC,
      [`${BILLING}/domain/value-objects/money.vo.ts`]: 'export class Money {}\n',
      [`${BILLING}/test/unit/money.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'an aggregate without a spec',
    expect: { file: AGGREGATE },
    files: project({ [AGGREGATE]: 'export class Invoice {}\n', [BUILDER]: 'export const anInvoice = 1;\n' }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'a handler whose spec lives in another context',
    expect: { file: HANDLER },
    files: project({ [HANDLER]: 'export class IssueInvoiceHandler {}\n', [`${CATALOG}/test/unit/issue-invoice.handler.spec.ts`]: SPEC }),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test built on a fake',
    expect: 'pass',
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: "import { it } from 'vitest';\nconst note = 'no vi.fn() here';\n// jest.mock('x')\nit.todo(note);\n",
    }, { [CONFIG_FILE]: config({ rules: { 'clean/no-commented-out-code': 'off' } }) }),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test using vi.fn and vi.spyOn',
    expect: { file: HANDLER_SPEC },
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: "import { it, vi } from 'vitest';\nconst save = vi.fn();\nvi.spyOn(console, 'log');\nit.todo(String(save));\n",
    }),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test importing a mocking library',
    expect: { file: HANDLER_SPEC },
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: "import { it } from 'vitest';\nimport sinon from 'sinon';\nit.todo(String(sinon));\n",
    }),
  },
  {
    ruleId: 'test/builder-required',
    name: 'an aggregate with its builder',
    expect: 'pass',
    files: project(aggregate('export class Invoice {}\n')),
  },
  {
    ruleId: 'test/builder-required',
    name: 'an aggregate without a builder',
    expect: { file: AGGREGATE },
    files: project({ [AGGREGATE]: 'export class Invoice {}\n', [AGGREGATE_SPEC]: SPEC }),
  },
];
