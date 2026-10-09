import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { run } from '../src/cli.js';

export interface CliResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  json(): unknown;
}

/** Runs the CLI in process, in `cwd`, and captures what it prints. */
export function cli(cwd: string, ...args: string[]): CliResult {
  const out: string[] = [];
  const err: string[] = [];
  const code = run([...args, '--cwd', cwd], { out: (text) => out.push(text), err: (text) => err.push(text) });
  const stdout = out.join('\n');
  return { code, stdout, stderr: err.join('\n'), json: () => JSON.parse(stdout) as unknown };
}

const created: string[] = [];

export function tempDir(label: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `ddd-ts-kit-${label}-`));
  created.push(directory);
  return directory;
}

afterAll(() => {
  for (const directory of created.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

export function read(root: string, file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

export function write(root: string, file: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

export function exists(root: string, file: string): boolean {
  return fs.existsSync(path.join(root, file));
}

export function walk(root: string, directory = ''): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const relative = directory === '' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(root, relative));
    else found.push(relative);
  }
  return found.sort();
}

export interface StackFlags {
  readonly http: string;
  readonly validation: string;
  readonly di: string;
  readonly tests: string;
  readonly orm: string;
  readonly events: string;
  readonly authn?: string;
  readonly authz?: string;
  readonly broker?: string;
  readonly ci?: string;
  readonly cache?: string;
  readonly audit?: string;
}

export const DEFAULT_STACK: StackFlags = { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'drizzle', events: 'outbox' };

/** `init`, then one `generate` of every kind, the way a team would: the language first. Returns each command's result. */
export function scaffoldEverything(root: string, stack: StackFlags = DEFAULT_STACK): CliResult[] {
  const results: CliResult[] = [];
  const step: Step = (...args) => {
    results.push(must(cli(root, ...args, '--json'), args.join(' ')));
  };
  const withHttp = stack.http !== 'none';
  // Leaving the outbox out with a database is a deviation: it has to be given its reason.
  const noOutbox = stack.orm !== 'none' && stack.events !== 'outbox' ? ['--allow-no-outbox', 'A single process with no consumer that has to survive a crash'] : [];
  step('init', ...Object.entries(stack).flatMap(([key, value]) => [`--${key}`, String(value)]), ...noOutbox);
  scaffoldBilling(step, withHttp);
  if (takesStandardDecorators(stack)) scaffoldDecoratedAdapter(step);
  scaffoldShipping(step);
  scaffoldOrderFulfilment(step, withHttp);
  return results;
}

type Step = (...args: string[]) => void;

/** `generate adapter --decorators` is refused where decorator syntax has its legacy meaning (class-validator, NestJS) and under jest. */
export function takesStandardDecorators(stack: StackFlags): boolean {
  return stack.validation !== 'class-validator' && stack.http !== 'nest' && stack.tests !== 'jest';
}

function scaffoldDecoratedAdapter(step: Step): void {
  step('generate', 'port', 'billing', 'TaxRates');
  step('generate', 'adapter', 'billing', 'TaxRates', '--decorators');
}

const term = (row: string): string[] => ['--term', row];

function scaffoldBilling(step: Step, withHttp: boolean): void {
  const purpose = 'Bills customers for what they bought. Owns invoices from draft to payment.';
  const terms = ['Invoice=A request for payment sent to a customer', 'Issue=To make an invoice final and send it', 'Cancel=To void an invoice before payment'];
  step('generate', 'context', 'billing', '--classification', 'core', '--purpose', purpose, ...terms.flatMap(term));
  step('generate', 'aggregate', 'billing', 'Invoice');
  step('generate', 'entity', 'billing', 'InvoiceLine', ...term('Line=One billed item of an invoice'));
  step('g', 'vo', 'billing', 'Money', ...term('Money=An amount in a currency'));
  step('generate', 'domain-event', 'billing', 'Invoice', 'Issued');
  step('generate', 'domain-error', 'billing', 'InvoiceAlreadyIssued', '--code', 'INVOICE_ALREADY_ISSUED');
  step('generate', 'domain-service', 'billing', 'Pricing', ...term('Price=What a customer pays for one item'));
  step('generate', 'repository', 'billing', 'Invoice');
  step('generate', 'command', 'billing', 'IssueInvoice', '--aggregate', 'Invoice', '--permission', 'invoice.issue');
  step('generate', 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel');
  step('generate', 'query', 'billing', 'ListInvoices', '--permission', 'invoice.list', '--list', ...term('List=To show invoices to their customer'));
  step('generate', 'port', 'billing', 'PaymentGateway');
  step('generate', 'adapter', 'billing', 'PaymentGateway');
  step('generate', 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');
  if (withHttp) scaffoldBillingRoutes(step);
  step('generate', 'integration-event', 'billing', 'Invoice', 'Issued');
  step('generate', 'integration-event', 'billing', 'Invoice', 'Issued', '--version', '2');
  step('generate', 'event-handler', 'billing', 'Invoice', 'Issued');
  step('generate', 'acl', 'billing', 'LegacyErp');
  // A prerequisite created on the way: the domain event does not exist yet.
  step('generate', 'event-handler', 'billing', 'Invoice', 'MarkedAsPaid', ...term('Mark=To record a status on an invoice'), ...term('Pay=To settle an invoice'));
}

function scaffoldBillingRoutes(step: Step): void {
  step('generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');
  step('generate', 'route', 'billing', 'CancelInvoice', '--method', 'DELETE', '--path', '/invoices/:invoiceId', '--command');
  step('generate', 'route', 'billing', 'ListInvoices', '--method', 'GET', '--path', '/invoices', '--query');
  step('generate', 'e2e', 'billing', 'IssueInvoice');
}

/** A downstream context: one consumer of a declared event, one of an event without a declaration. */
function scaffoldShipping(step: Step): void {
  step('generate', 'context', 'shipping', '--classification', 'supporting', '--upstream', 'billing:customer-supplier', ...term('Parcel=A package handed to a carrier'));
  step('generate', 'consumer', 'shipping', 'billing', 'billing.invoice.issued');
  step('generate', 'consumer', 'shipping', 'billing', 'billing.invoice.cancelled');
  step('generate', 'gateway', 'shipping', 'billing', 'InvoiceStatus');
  step('generate', 'adapter', 'shipping', 'InvoiceStatusGateway', '--kind', 'gateway');
  step('generate', 'service', 'shipping');
  step('generate', 'adr', 'Keep shipping in the same repository as billing');
}

/** A context name in several words, a repository created by its command, a query behind a parameterised route. */
function scaffoldOrderFulfilment(step: Step, withHttp: boolean): void {
  const terms = ['Purchase order=What a customer asked to receive', 'Place=To submit a purchase order', 'Track=To follow a purchase order'];
  step('generate', 'context', 'order-fulfilment', '--classification', 'generic', ...terms.flatMap(term));
  step('generate', 'aggregate', 'order-fulfilment', 'PurchaseOrder');
  step('generate', 'builder', 'order-fulfilment', 'PurchaseOrder', '--force');
  step('generate', 'repository', 'order-fulfilment', 'PurchaseOrder', '--tenant-scoped');
  step('generate', 'command', 'order-fulfilment', 'PlacePurchaseOrder', '--aggregate', 'PurchaseOrder', '--permission', 'purchase-order.place');
  step('generate', 'query', 'order-fulfilment', 'TrackPurchaseOrder', '--public');
  if (!withHttp) return;
  step('generate', 'route', 'order-fulfilment', 'PlacePurchaseOrder', '--method', 'PUT', '--path', '/purchase-orders/:purchaseOrderId');
  step('generate', 'route', 'order-fulfilment', 'TrackPurchaseOrder', '--method', 'GET', '--path', '/purchase-orders/:purchaseOrderId/tracking');
  step('generate', 'e2e', 'order-fulfilment', 'TrackPurchaseOrder');
}

function must(result: CliResult, what: string): CliResult {
  if (result.code !== 0) throw new Error(`${what} failed (${result.code}): ${result.stderr || result.stdout}`);
  return result;
}

export const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

