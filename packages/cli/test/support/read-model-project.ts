import { cli, type CliResult } from '../helpers';
import { expectOk } from './expect-ok';
import { initProject } from './init-project';

export const BILLING = 'src/contexts/billing';
export const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
export const PORT = `${BILLING}/application/ports/invoice-summaries.port.ts`;
export const FAKE = `${BILLING}/test/fakes/invoice-summaries.fake.ts`;
export const CONTRACT = `${BILLING}/test/integration/invoice-summaries.contract.spec.ts`;

/** A field of each type, one of them nullable. */
export const FIELDS = [
  'customerId:string',
  'total:decimal',
  'issuedAt:instant',
  'paidAt:instant:nullable',
  'lines:number',
  'paid:boolean',
];

/** A project of the given stack with one context, billing, which stores nothing yet. */
export function billingProject(...flags: readonly string[]): string {
  return initProject(...flags, '--context', 'billing:core');
}

/** `generate read-model billing <Name>` with the fields above and what follows, its report as JSON. */
export function generateReadModel(root: string, name: string, ...more: readonly string[]): CliResult {
  const fields = FIELDS.flatMap((field) => ['--field', field]);

  return cli(root, 'generate', 'read-model', 'billing', name, ...fields, ...more, '--json');
}

/** The read model InvoiceSummaries of billing, generated. */
export function withInvoiceSummaries(root: string, ...more: readonly string[]): CliResult {
  return expectOk(generateReadModel(root, 'InvoiceSummaries', ...more));
}
