import { declaration } from './declaration.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { BILLING, EVENT, PUBLISHED } = PATHS;
const { DECLARE } = SAMPLES;

export const EVENTS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'events/name-format',
    name: 'context.aggregate.fact names',
    expect: 'pass',
    files: project({
      [EVENT]:
        "export class InvoiceIssued {\n  readonly name = 'billing.invoice.issued';\n  readonly label: string = 'Invoice issued';\n}\n",
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.marked-as-paid')}`,
      [`${BILLING}/published-language/invoice-summary.ts`]:
        "export interface InvoiceSummary { readonly type: 'standard' | 'credit-note' }\n",
    }),
  },
  {
    ruleId: 'events/name-format',
    name: 'a domain event named like its class',
    expect: { file: EVENT },
    files: project({ [EVENT]: "export class InvoiceIssued {\n  readonly name = 'InvoiceIssued';\n}\n" }),
  },
  {
    ruleId: 'events/name-format',
    name: 'an integration event carrying the prefix of another context',
    expect: { file: PUBLISHED },
    files: project({ [PUBLISHED]: `${DECLARE}${declaration('catalog.invoice.issued')}` }),
  },
  {
    ruleId: 'events/defined-in-published-language',
    name: 'two versions of an event, each declared once with a payload schema',
    expect: 'pass',
    files: project({
      [PUBLISHED]: `${DECLARE}${declaration('billing.invoice.issued')}`,
      [`${BILLING}/published-language/invoice-issued.v2.integration-event.ts`]: `${DECLARE}${declaration('billing.invoice.issued', 2)}`,
      [`${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`]:
        "import { invoiceIssuedV1 } from '#src/contexts/billing/published-language/invoice-issued.v1.integration-event.js';\nexport class InvoiceIssuedPublisher { readonly definition = invoiceIssuedV1; }\n",
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
