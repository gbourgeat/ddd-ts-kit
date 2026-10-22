import { declaration } from './declaration';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';

const { BILLING, EVENT, PUBLISHED } = PATHS;
const { DECLARE } = SAMPLES;

export const EVENTS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'events/name-format',
    name: 'context.aggregate.fact names',
    expect: 'pass',
    files: project({
      [EVENT]:
        "export class InvoiceIssued {\n  static readonly eventName = 'billing.invoice.issued';\n\n  readonly name = InvoiceIssued.eventName;\n  readonly label: string = 'Invoice issued';\n}\n",
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.marked-as-paid')}`,
      [`${BILLING}/published-language/invoice-summary.ts`]:
        "export interface InvoiceSummary { readonly type: 'standard' | 'credit-note' }\n",
    }),
  },
  {
    ruleId: 'events/name-format',
    name: 'a domain event named like its class',
    expect: { file: EVENT },
    also: ['events/name-declared-once'],
    files: project({ [EVENT]: "export class InvoiceIssued {\n  readonly name = 'InvoiceIssued';\n}\n" }),
  },
  {
    ruleId: 'events/name-format',
    name: 'a domain event declaring once a name like its class',
    expect: { file: EVENT },
    files: project({
      [EVENT]:
        "export class InvoiceIssued {\n  static readonly eventName = 'InvoiceIssued';\n\n  readonly name = InvoiceIssued.eventName;\n}\n",
    }),
  },
  {
    ruleId: 'events/name-format',
    name: 'an integration event carrying the prefix of another context',
    expect: { file: PUBLISHED },
    files: project({ [PUBLISHED]: `${DECLARE}${declaration('catalog.invoice.issued')}` }),
  },
  {
    ruleId: 'events/name-declared-once',
    name: 'a domain event declaring its name once, read by its name property',
    expect: 'pass',
    files: project({
      [EVENT]:
        "export class InvoiceIssued {\n  static readonly eventName = 'billing.invoice.issued';\n\n  readonly name = InvoiceIssued.eventName;\n}\n",
    }),
  },
  {
    ruleId: 'events/name-declared-once',
    name: 'a domain event that names itself nowhere',
    expect: { file: EVENT },
    files: project({ [EVENT]: 'export class InvoiceIssued {\n  readonly total: number = 0;\n}\n' }),
  },
  {
    ruleId: 'events/name-declared-once',
    name: 'a domain event naming itself in readonly name alone, as 0.5 wrote it',
    expect: { file: EVENT },
    files: project({ [EVENT]: "export class InvoiceIssued {\n  readonly name = 'billing.invoice.issued';\n}\n" }),
  },
  {
    ruleId: 'events/name-declared-once',
    name: 'a domain event writing its name twice',
    expect: { file: EVENT },
    files: project({
      [EVENT]:
        "export class InvoiceIssued {\n  static readonly eventName = 'billing.invoice.issued';\n\n  readonly name = 'billing.invoice.issued';\n}\n",
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'two versions of an event, each declared once with a payload schema',
    expect: 'pass',
    files: project({
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.issued')}`,
      [`${BILLING}/published-language/invoice-issued.v2.integration-event.ts`]: `${DECLARE}${declaration('billing.invoice.issued', 2)}`,
      [`${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`]:
        "import { invoiceIssuedV1 } from '@/contexts/billing/published-language/invoice-issued.v1.integration-event.js';\nexport class InvoiceIssuedPublisher { readonly definition = invoiceIssuedV1; }\n",
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'an event declared in the application layer',
    expect: { file: `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts` },
    also: ['layer/application-inward', 'clean/one-export-per-file'],
    files: project({
      [`${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`]: `${DECLARE}${declaration('billing.invoice.issued')}`,
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'a declaration without a payload schema',
    expect: { file: PUBLISHED },
    files: project({
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.issued', 1, "description: 'payload: later'")}`,
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'the same version declared twice',
    expect: { file: `${BILLING}/published-language/invoice-issued.v1.second.integration-event.ts` },
    files: project({
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.issued')}`,
      [`${BILLING}/published-language/invoice-issued.v1.second.integration-event.ts`]: `${DECLARE}${declaration('billing.invoice.issued')}`,
    }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'an event described by hand in the published language',
    expect: { file: PUBLISHED },
    files: project({
      [PUBLISHED]: "export type InvoiceIssuedV1 = Readonly<{ type: 'billing.invoice.issued'; version: 1 }>;\n",
    }),
  },
];
