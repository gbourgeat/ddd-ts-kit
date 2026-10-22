import { CONFIG_FILE } from '../../config';
import { aggregate } from './aggregate';
import { config } from './config';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';

const { AGGREGATE, AGGREGATE_SPEC, BILLING, BUILDER, CATALOG, HANDLER, HANDLER_SPEC } = PATHS;
const WORLD = `${BILLING}/test/worlds/billing.world.ts`;
const { SPEC } = SAMPLES;
const REMINDER_SERVICE = `${BILLING}/domain/services/reminder.service.ts`;
const ACCEPTANCE_SPEC = 'test/acceptance/us5.acceptance.spec.ts';
const START = 'test/e2e/support/start-application.ts';

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
    name: 'an abstract strategy of the domain, held by the spec of its implementation',
    expect: 'pass',
    files: project({
      [REMINDER_SERVICE]: 'export abstract class ReminderService {\n  abstract isDue(daysLate: number): boolean;\n}\n',
      [`${BILLING}/domain/services/invoice-reminder.service.ts`]: [
        "import { ReminderService } from '@/contexts/billing/domain/services/reminder.service.js';",
        '',
        'export class InvoiceReminderService extends ReminderService {',
        '  isDue(daysLate: number): boolean {',
        '    return daysLate > 0;',
        '  }',
        '}',
        '',
      ].join('\n'),
      [`${BILLING}/test/unit/invoice-reminder.service.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'an abstract class next to an exported function still needs its spec',
    expect: { file: REMINDER_SERVICE },
    files: project(
      {
        [REMINDER_SERVICE]:
          'export abstract class ReminderService {}\n\nexport function reminderService(): number {\n  return 1;\n}\n',
      },
      {
        [CONFIG_FILE]: config({
          onePerFile: { allow: [{ file: REMINDER_SERVICE, reason: 'The base and its default are one rule.' }] },
        }),
      },
    ),
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
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [`${CATALOG}/test/unit/issue-invoice.handler.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test built on a fake',
    expect: 'pass',
    files: project(
      {
        [HANDLER]: 'export class IssueInvoiceHandler {}\n',
        [HANDLER_SPEC]:
          "import { it } from 'vitest';\nconst note = 'no vi.fn() here';\n// jest.mock('x')\nit.todo(note);\n",
      },
      {
        [CONFIG_FILE]: config({ rules: { 'clean/no-commented-out-code': { severity: 'off', files: [HANDLER_SPEC] } } }),
      },
    ),
  },
  {
    ruleId: 'test/no-mocks',
    name: 'a test using vi.fn and vi.spyOn',
    expect: { file: HANDLER_SPEC },
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]:
        "import { it, vi } from 'vitest';\nconst save = vi.fn();\nvi.spyOn(console, 'log');\nit.todo(String(save));\n",
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
  {
    ruleId: 'test/acceptance-black-box',
    name: 'an acceptance spec that drives the application, its data from the builder of a context',
    expect: 'pass',
    files: project({
      ...aggregate('export class Invoice {}\n'),
      [START]: 'export const startApplication = (): number => 1;\n',
      [ACCEPTANCE_SPEC]: [
        "import { it } from 'vitest';",
        "import { pending } from '@ddd-ts-kit/testing/e2e';",
        "import { startApplication } from '$test/e2e/support/start-application.js';",
        "import { anInvoice } from '@/contexts/billing/test/builders/invoice.builder.js';",
        '',
        "it('#US5.02 AC1 an invoice is issued', pending(async () => startApplication() + anInvoice));",
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'test/acceptance-black-box',
    name: 'an acceptance spec that imports an aggregate',
    expect: { file: ACCEPTANCE_SPEC },
    files: project({
      ...aggregate('export class Invoice {}\n'),
      [ACCEPTANCE_SPEC]: [
        "import { it } from 'vitest';",
        "import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';",
        '',
        "it('#US5.02 AC1 an invoice is issued', () => new Invoice());",
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'test/helper-placed',
    name: 'specs, a declaration file, and a world, a builder and a fake in their places',
    expect: 'pass',
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: SPEC,
      [`${BILLING}/test/integration/deep/invoice.repository.test.ts`]: SPEC,
      [`${BILLING}/test/unit/globals.d.ts`]: 'export {};\n',
      [WORLD]: 'export const aBillingWorld = 1;\n',
      [BUILDER]: 'export const anInvoice = 1;\n',
      [`${BILLING}/test/fakes/payment-gateway.fake.ts`]: 'export class FakePaymentGateway {}\n',
    }),
  },
  {
    ruleId: 'test/helper-placed',
    name: 'an arrangement several specs import, written among them',
    expect: { file: `${BILLING}/test/unit/billing-application.ts` },
    files: project({
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [HANDLER_SPEC]: SPEC,
      [`${BILLING}/test/unit/billing-application.ts`]: 'export const arrangeBilling = 1;\n',
    }),
  },
];
