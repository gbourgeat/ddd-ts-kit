import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli } from '../helpers.js';
import { DEPCRUISE, KNIP } from './analyzers.js';
import { EditedProject } from './edited-project.js';
import { findingsOf } from './run-in.js';
import { SLOW } from './stacks.js';

const BILLING = 'src/contexts/billing';
const SERVICE = `${BILLING}/domain/services/pricing.service.ts`;
const COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const BARREL = `${BILLING}/billing.declarations.ts`;

/** Slow, opt-in (DDD_TS_KIT_E2E=1): one deliberate violation at a time, caught by the analyzer that holds the rule. */
describe.runIf(SLOW)('a violation written into a generated project', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate();
  }, 120_000);

  afterEach(() => {
    project.restore();
  });

  it('is absent from the files these tests edit, as generated', () => {
    expect(project.linted(SERVICE, COMMAND, HANDLER, EVENT_HANDLER, BARREL)).toBe('');
    expect(project.checkedRules()).toEqual([]);
  }, 120_000);

  it('ESLint catches a generic error thrown by the domain', () => {
    project.append(SERVICE, "\nexport function refuse(): never {\n  throw new Error('refused');\n}\n");

    expect(project.linted(SERVICE)).toContain('ddd-ts-kit/domain-no-generic-error');
  }, 120_000);

  it('dependency-cruiser catches a domain that imports its infrastructure', () => {
    project.prepend(SERVICE, "import '../../infrastructure/persistence/invoice.mapper.js';\n");

    expect(findingsOf(project.root, DEPCRUISE)).toContain('layer-domain-purity');
  }, 120_000);

  it('both analyzers catch a command that no longer says who may send it', () => {
    project.edit(COMMAND, "@Requires(billingPermissions['invoice.issue'])\n", '');

    expect(project.checkedRules()).toContain('authz/declared');
    expect(project.linted(COMMAND)).toContain('ddd-ts-kit/authz-declared');
  }, 120_000);

  it('both analyzers catch a handler that no longer declares itself', () => {
    project.edit(HANDLER, '@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, IdGenerator, Clock])\n', '');

    expect(project.checkedRules()).toContain('declarations/role-declared');
    expect(project.linted(HANDLER)).toContain('ddd-ts-kit/declarations-role-declared');
  }, 120_000);

  it('both analyzers catch a domain event handler named after another event than the one it handles', () => {
    project.edit(EVENT_HANDLER, "{ name: 'billing.invoice.issued' }", "{ name: 'billing.invoice.sent' }");

    expect(project.checkedRules()).toContain('declarations/role-declared');
    expect(project.linted(EVENT_HANDLER)).toContain('ddd-ts-kit/declarations-role-declared');
  }, 120_000);

  it('the checker catches a barrel that a role file written by hand left behind, and so does the documentation check', () => {
    project.edit(BARREL, "export * from './application/commands/issue-invoice/issue-invoice.handler.js';\n", '');

    expect(project.checkedRules()).toContain('declarations/barrel-current');
    expect(cli(project.root, 'docs', '--check').stdout).toContain(`stale  ${BARREL}`);
  }, 120_000);

  it('knip catches an export nothing uses', () => {
    project.append(SERVICE, '\nexport const FORGOTTEN_RATE = 0.2;\n');

    expect(findingsOf(project.root, KNIP)).toContain('FORGOTTEN_RATE');
  }, 120_000);
});
