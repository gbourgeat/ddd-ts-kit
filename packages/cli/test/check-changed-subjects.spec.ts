import { describe, expect, it } from 'vitest';
import { isReportedSince } from '../src/check/commands/is-reported-since';
import { runCheck } from '../src/check/engine/run-check';
import { loadProject } from '../src/check/project/load-project';
import { cli, write } from './helpers';
import { lines, projectWith } from './rules-support';
import { git } from './support/git';

const BILLING = 'src/contexts/billing';
const MODULE = `${BILLING}/billing.module.ts`;
const HANDLER = `${BILLING}/application/integration/handlers/product-listed.integration-handler.ts`;
const SPLIT_MODULE = `${BILLING}/invoicing/invoicing.module.ts`;
const SPLIT_HANDLER = `${BILLING}/invoicing/application/integration/handlers/product-listed.integration-handler.ts`;
const MODULES = { contexts: { billing: { classification: 'core', upstreams: [], modules: { invoicing: {} } } } };

const CLASS = 'export class ProductListedIntegrationHandler {}\n';
const EMPTY_MODULE = 'export function billingModule(builder: Builder): void {}\n';

function violationsOf(root: string, rule: string) {
  return runCheck(loadProject(root), { rules: [rule] }).violations;
}

describe('a finding that a file other than its own causes', () => {
  it('names the module file of the context a missing consumer registration is fixed in', () => {
    const root = projectWith({ [HANDLER]: CLASS, [MODULE]: EMPTY_MODULE });
    const [violation] = violationsOf(root, 'events/consumer-idempotent');

    expect(violation).toMatchObject({ file: HANDLER, subjects: [MODULE] });
  });

  it('names the module file of the module of the model, which registers what the module holds', () => {
    const root = projectWith({ [SPLIT_HANDLER]: CLASS, [MODULE]: EMPTY_MODULE, [SPLIT_MODULE]: EMPTY_MODULE }, MODULES);

    const [violation] = violationsOf(root, 'events/consumer-idempotent');

    expect(violation?.file).toBe(SPLIT_HANDLER);
    expect(violation?.subjects).toEqual(expect.arrayContaining([MODULE, SPLIT_MODULE]));
  });

  it('accepts a handler registered in the module file of its module', () => {
    const registered = lines(
      'export function invoicingModule(builder: Builder): void {',
      "  builder.on(productListedV1, { consumer: 'billing.product-listed' }).handledBy(ProductListedIntegrationHandler, []);",
      '}',
    );

    const root = projectWith({ [SPLIT_HANDLER]: CLASS, [MODULE]: EMPTY_MODULE, [SPLIT_MODULE]: registered }, MODULES);

    expect(violationsOf(root, 'events/consumer-idempotent')).toEqual([]);
  });

  it('names where an unwired adapter and an undeclared use case are fixed', () => {
    const root = projectWith(
      {
        [`${BILLING}/domain/repositories/invoice.repository.ts`]: 'export abstract class InvoiceRepository {}\n',
        [`${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`]: lines(
          "import { InvoiceRepository } from '../../domain/repositories/invoice.repository';",
          'export class KnexInvoiceRepository implements InvoiceRepository {}',
        ),
        [`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`]:
          'export class IssueInvoiceHandler { constructor(private readonly invoices: InvoiceRepository) {} }\n',
        [`${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`]:
          'export class IssueInvoiceCommand {}\n',
        [MODULE]: EMPTY_MODULE,
      },
      { stack: { di: 'manual' } },
    );

    expect(violationsOf(root, 'declarations/port-adapter-wired')[0]?.subjects).toContain(MODULE);
    expect(violationsOf(root, 'authz/declared')[0]?.subjects).toContain(MODULE);
  });
});

describe('--changed-since', () => {
  const violation = { ruleId: 'r', severity: 'error', file: 'a.ts', line: 1, message: 'm', fix: 'f' } as const;

  it('keeps a finding whose file changed, or whose subject changed', () => {
    expect(isReportedSince(violation, new Set(['a.ts']))).toBe(true);
    expect(isReportedSince({ ...violation, subjects: ['b.ts'] }, new Set(['b.ts']))).toBe(true);
    expect(isReportedSince({ ...violation, subjects: ['b.ts'] }, new Set(['c.ts']))).toBe(false);
    expect(isReportedSince(violation, new Set(['b.ts']))).toBe(false);
  });

  it('keeps every finding when nothing is compared', () => {
    expect(isReportedSince(violation, undefined)).toBe(true);
  });
});

describe('check --changed-since', () => {
  it('reports a handler no module file registers when only the module file changed', () => {
    const root = projectWith({ [HANDLER]: CLASS, [MODULE]: EMPTY_MODULE });

    git(root, 'init', '--quiet', '--initial-branch', 'main');
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'chore: start');
    git(root, 'switch', '--quiet', '--create', 'work');
    write(root, MODULE, `${EMPTY_MODULE}// touched\n`);
    git(root, 'commit', '--quiet', '--all', '--message', 'chore: touch the module');

    const rule = ['--rule', 'events/consumer-idempotent', '--json'];

    const files = (result: ReturnType<typeof cli>) =>
      (result.json() as { violations: { file: string }[] }).violations.map(({ file }) => file);

    expect(files(cli(root, 'check', '--changed-since', 'main', ...rule))).toEqual([HANDLER]);

    git(root, 'reset', '--quiet', '--hard', 'main');
    write(root, 'src/other.ts', 'export const other = 1;\n');

    expect(files(cli(root, 'check', '--changed-since', 'main', ...rule))).toEqual([]);
  });
});
