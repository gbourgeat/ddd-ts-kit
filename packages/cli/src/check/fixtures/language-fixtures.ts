import { CONTEXT_DOC_HEADINGS } from '../canonical/context-doc-headings.js';
import { aggregate } from './aggregate.js';
import { contextDoc } from './context-doc.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { AGGREGATE, BILLING, EVENT } = PATHS;
const { SPEC } = SAMPLES;

export const LANGUAGE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'language/glossary-term',
    name: 'names made of glossary terms, inflected, with structural and link words',
    expect: 'pass',
    files: project({
      ...aggregate('export class Invoice {}\n'),
      [EVENT]: "export class InvoiceIssued {\n  readonly name = 'billing.invoice.issued';\n}\n",
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`]:
        'export class IssueInvoiceCommand {}\n',
      [`${BILLING}/application/queries/invoices-issued-for-money/invoices-issued-for-money.query.ts`]:
        'export class InvoicesIssuedForMoneyQuery {}\n',
    }),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a class named with a word the glossary does not define',
    expect: { file: `${BILLING}/domain/aggregates/invoice-ledger.aggregate.ts` },
    files: project({
      [`${BILLING}/domain/aggregates/invoice-ledger.aggregate.ts`]: 'export class InvoiceLedger {}\n',
      [`${BILLING}/test/unit/invoice-ledger.aggregate.spec.ts`]: SPEC,
      [`${BILLING}/test/builders/invoice-ledger.builder.ts`]: 'export const anInvoiceLedger = 1;\n',
    }),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a use case whose verb is not in the glossary',
    expect: { file: `${BILLING}/application/commands/dispatch-invoice/dispatch-invoice.command.ts` },
    files: project({
      [`${BILLING}/application/commands/dispatch-invoice/dispatch-invoice.command.ts`]:
        'export class DispatchInvoiceCommand {}\n',
    }),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'domain classes in a context whose glossary is empty',
    expect: { file: `${BILLING}/CONTEXT.md` },
    files: project(aggregate('export class Invoice {}\n'), {
      [`${BILLING}/CONTEXT.md`]: contextDoc('core', CONTEXT_DOC_HEADINGS, '| Term | Meaning |\n|---|---|'),
    }),
  },
  {
    ruleId: 'language/no-technical-name',
    name: 'names of the business',
    expect: 'pass',
    files: project({
      ...aggregate(
        'export interface InvoiceState {\n  readonly issued: boolean;\n}\n\nexport class Invoice {\n  constructor(readonly state: InvoiceState) {}\n}\n',
      ),
      [`${BILLING}/infrastructure/persistence/invoice-data.mapper.ts`]: 'export class InvoiceDataMapper {}\n',
    }),
  },
  {
    ruleId: 'language/no-technical-name',
    name: 'a manager in the domain',
    expect: { file: `${BILLING}/domain/services/invoice-manager.service.ts` },
    also: ['language/glossary-term'],
    files: project({
      [`${BILLING}/domain/services/invoice-manager.service.ts`]: 'export class InvoiceManager {}\n',
      [`${BILLING}/test/unit/invoice-manager.service.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'language/no-technical-name',
    name: 'a technical word in a use case and in a domain type',
    expect: { file: AGGREGATE },
    files: project(aggregate('export type InvoiceData = { readonly total: number };\nexport class Invoice {}\n')),
  },
];
