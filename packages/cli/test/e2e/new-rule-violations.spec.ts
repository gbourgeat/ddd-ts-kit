import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EditedProject } from './edited-project.js';
import { SLOW } from './stacks.js';

const BILLING = 'src/contexts/billing';
const PORT = `${BILLING}/application/ports/payment-gateway.port.ts`;
const ADAPTER = `${BILLING}/infrastructure/external/remote-payment-gateway.adapter.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const SERVICE = `${BILLING}/domain/services/pricing.service.ts`;
const JOB = `${BILLING}/application/scheduling/cancel-stale-invoices.job.ts`;
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const OTHER_JOB = `${BILLING}/application/scheduling/issue-invoices-monthly.job.ts`;
const LIST = '[InvoiceRepository, IdGenerator, Clock]';
const SAVED = '    await this.invoiceRepository.save(target);\n';
const SENT = "    await this.commands.execute(new CancelInvoiceCommand(systemActor('billing.cancel-stale-invoices')));";
const ADAPTER_IMPORT = "import { DrizzleInvoiceRepository } from '../../../infrastructure/persistence/drizzle-invoice.repository.js';\n";
const DECLARED = "import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';\nimport { InvoiceIssued } from '../../domain/events/invoice-issued.event.js';\n\n@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })";
const CACHING = `import { Cache } from '@ddd-ts-kit/kernel';\n${DECLARED.replace(' })', ' }, [Cache])')}`;
const SPRAWL = `\nexport function sprawl(): number {\n  let total = 0;\n\n${'  total += 1;\n'.repeat(101)}\n  return total;\n}\n`;

interface Injection {
  /** The rule as the checker names it. */
  readonly rule: string;
  /** The rule as ESLint names it. */
  readonly eslint: string;
  readonly what: string;
  readonly file: string;
  /** What the generated file holds, and what the violation writes in its place; an empty `from` appends. */
  readonly from: string;
  readonly to: string;
}

const INJECTIONS: readonly Injection[] = [
  { rule: 'ports/abstract-class', eslint: 'ddd-ts-kit/ports-abstract-class', what: 'a port with a method body', file: PORT, from: 'export abstract class PaymentGateway {\n', to: 'export abstract class PaymentGateway {\n  charge(): void {}\n\n' },
  { rule: 'ports/implements-never-extends', eslint: 'ddd-ts-kit/ports-implements-never-extends', what: 'an adapter that extends its port', file: ADAPTER, from: 'implements PaymentGateway', to: 'extends PaymentGateway' },
  { rule: 'ports/no-token-constant', eslint: 'ddd-ts-kit/ports-no-token-constant', what: 'an upper-case constant in a dependency list', file: HANDLER, from: LIST, to: LIST.replace('InvoiceRepository', 'INVOICE_REPOSITORY') },
  { rule: 'ports/no-concrete-dependency', eslint: 'ddd-ts-kit/ports-no-concrete-dependency', what: 'an adapter named in a dependency list', file: HANDLER, from: `\n@CommandHandler(IssueInvoiceCommand, ${LIST}`, to: `${ADAPTER_IMPORT}\n@CommandHandler(IssueInvoiceCommand, ${LIST.replace('InvoiceRepository', 'DrizzleInvoiceRepository')}` },
  { rule: 'ports/value-import', eslint: 'ddd-ts-kit/ports-value-import', what: 'a port of a dependency list imported as a type', file: HANDLER, from: 'import { InvoiceRepository } from', to: 'import type { InvoiceRepository } from' },
  { rule: 'clean/no-hash-private', eslint: 'ddd-ts-kit/clean-no-hash-private', what: 'a #private member', file: JOB, from: '  constructor(private readonly commands: CommandBus) {}', to: '  #runs = 0;\n\n  constructor(private readonly commands: CommandBus) {}' },
  { rule: 'clean/blank-lines', eslint: '@stylistic/padding-line-between-statements', what: 'a return glued to the statement above it', file: HANDLER, from: '\n\n    return target.id;', to: '\n    return target.id;' },
  { rule: 'clean/one-export-per-file', eslint: 'ddd-ts-kit/clean-one-export-per-file', what: 'a second exported class', file: SERVICE, from: '', to: '\nexport class RoundingService {}\n' },
  { rule: 'clean/file-size', eslint: 'ddd-ts-kit/clean-file-size', what: 'a file of more than 350 lines', file: SERVICE, from: '', to: 'void 0;\n'.repeat(350) },
  { rule: 'clean/function-size', eslint: 'ddd-ts-kit/clean-function-ceiling', what: 'a function of more than 100 lines', file: SERVICE, from: '', to: SPRAWL },
  { rule: 'scheduling/job-triggers-use-case', eslint: 'ddd-ts-kit/scheduling-job-triggers-use-case', what: 'a job that sends no command', file: JOB, from: SENT, to: '    await Promise.resolve(execution);' },
  { rule: 'domain-events/dispatched-on-save', eslint: 'ddd-ts-kit/domain-events-dispatched-on-save', what: 'a handler that pulls the events of the aggregate it saved', file: HANDLER, from: SAVED, to: `${SAVED}    target.pullEvents();\n` },
  { rule: 'domain-events/transactional-before-commit', eslint: 'ddd-ts-kit/domain-events-transactional-before-commit', what: 'a before-commit domain event handler given the cache', file: EVENT_HANDLER, from: DECLARED, to: CACHING },
  { rule: 'tracing/platform-only', eslint: 'ddd-ts-kit/tracing-platform-only', what: 'a tracing import outside the platform', file: ADAPTER, from: '', to: "\nexport { withSpan } from '@ddd-ts-kit/tracing';\n" },
  { rule: 'scheduling/job-name', eslint: 'ddd-ts-kit/scheduling-job-name', what: 'a job name that is not <context>.<job-name>', file: JOB, from: "@Scheduled('billing.cancel-stale-invoices'", to: "@Scheduled('CancelStale'" },
];

/** Slow, opt-in (DDD_TS_KIT_E2E=1): one deliberate violation per rule of this wave, caught by the checker and by ESLint with the preset. */
describe.runIf(SLOW)('a violation of a rule of this wave, written into a generated project', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate();
  }, 120_000);

  afterEach(() => {
    project.restore();
  });

  it('is absent from the files these tests edit, as generated', () => {
    expect(project.linted(PORT, ADAPTER, HANDLER, SERVICE, JOB, OTHER_JOB, EVENT_HANDLER)).toBe('');
    expect(project.checkedRules()).toEqual([]);
  }, 120_000);

  it.each(INJECTIONS)('both analyzers catch $what ($rule)', ({ rule, eslint, file, from, to }) => {
    if (from === '') project.append(file, to);
    else project.edit(file, from, to);

    expect(project.checkedRules()).toContain(rule);
    expect(project.linted(file)).toContain(eslint);
  }, 120_000);

  it('the ceiling of 100 lines is an error for the checker, whatever the severity of clean/function-size', () => {
    project.append(SERVICE, SPRAWL);

    expect(project.checked().filter((violation) => violation.ruleId === 'clean/function-size')).toEqual([expect.objectContaining({ severity: 'error', file: SERVICE })]);
  }, 120_000);

  it('the checker catches a padded block, the approximation of the layout ESLint holds', () => {
    project.edit(JOB, '  async run(execution: JobExecution): Promise<void> {\n', '  async run(execution: JobExecution): Promise<void> {\n\n');

    expect(project.checkedRules()).toContain('clean/blank-lines');
    expect(project.linted(JOB)).toContain('@stylistic/padded-blocks');
  }, 120_000);

  it('the checker catches two jobs under one name, project-wide', () => {
    project.edit(OTHER_JOB, 'billing.issue-invoices-monthly', 'billing.cancel-stale-invoices');

    expect(project.checked().filter((violation) => violation.ruleId === 'scheduling/job-name').map((violation) => violation.message).join('\n')).toMatch(/billing\.cancel-stale-invoices[\s\S]*(?:unique|already|twice|two)/i);
  }, 120_000);
});
