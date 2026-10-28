import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { run } from '../src/run';
import { grantOf } from './support/grant-of';
import { refusalOf } from './support/refusal-of';
import { initFlags } from './support/init-flags';
import { scaffoldBillingJobs } from './support/scaffold-billing-jobs';
import { scaffoldBillingLifecycle } from './support/scaffold-billing-lifecycle';
import { scaffoldNamedReactions } from './support/scaffold-named-reactions';
import { scaffoldShippingReaction } from './support/scaffold-shipping-reaction';
import { STORY_SLICES } from './support/story-slices';
import type { StackFlags } from './support/stack-flags';

export type { StackFlags } from './support/stack-flags';

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

/**
 * The throwaway projects of a file are removed together: each holds a copy of every package of
 * the kit, and on a busy runner removing them one after the other outlasted the hook timeout of
 * the end-to-end run. A git process of a throwaway repository can still be writing its objects
 * when the file ends, hence the retries.
 */
const CLEANUP_TIMEOUT = 600_000;

afterAll(async () => {
  await Promise.all(
    created
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })),
  );
}, CLEANUP_TIMEOUT);

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
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    const relative = directory === '' ? entry.name : `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      found.push(...walk(root, relative));
    } else {
      found.push(relative);
    }
  }

  return found.sort();
}

export const DEFAULT_STACK: StackFlags = {
  http: 'express',
  validation: 'zod',
  di: 'tsyringe',
  tests: 'vitest',
  orm: 'drizzle',
  events: 'outbox',
};

/** `init` (with `more` flags), then one `generate` of every kind, the way a team would: the language first. Returns each command's result. */
export function scaffoldEverything(root: string, stack = DEFAULT_STACK, more: readonly string[] = []): CliResult[] {
  const results: CliResult[] = [];

  const step: Step = (...args) => {
    results.push(must(cli(root, ...args, '--json'), args.join(' ')));
  };

  const withHttp = stack.http !== 'none';

  step('init', ...initFlags(stack), ...more);
  scaffoldBilling(step, withHttp, grantOf(stack, more));
  step('generate', 'error', 'billing', ...refusalOf(more));

  if (withHttp) {
    // The acceptance of a story, written before its code: an it.todo per slice row of the story.
    write(root, 'docs/architecture/slices.md', STORY_SLICES);
    step('generate', 'acceptance', 'US1', 'Invoice a customer');
  }

  scaffoldDecoratedAdapter(step);
  scaffoldShipping(step, isDeclared(stack));
  scaffoldShippingReaction(step, withHttp, grantOf(stack, more));
  scaffoldOrderFulfilment(step, withHttp, grantOf(stack, more));
  scaffoldBillingLifecycle(step);
  scaffoldNamedReactions(step);
  // The arrangement the specs of billing share, once every fake of the context exists.
  step('generate', 'test-world', 'billing');
  step('generate', 'worker');

  return results;
}

type Step = (...args: string[]) => void;

/** The style `init` gives a stack that does not name one: declared wherever the declarations are read, on tsyringe. */
export function isDeclared(stack: StackFlags): boolean {
  return (stack.style ?? (stack.di === 'tsyringe' ? 'declared' : 'explicit')) === 'declared';
}

/** The default stack with every binding written in a module file, as before the declared style. */
export const EXPLICIT_STACK: StackFlags = { ...DEFAULT_STACK, style: 'explicit' };

/** An adapter whose outbound method carries its policy as decorators: they serve both decorator modes. */
function scaffoldDecoratedAdapter(step: Step): void {
  step('generate', 'port', 'billing', 'TaxRates');
  step('generate', 'adapter', 'billing', 'TaxRates', '--decorators');
}

const term = (row: string): string[] => ['--term', row];

function scaffoldBilling(step: Step, withHttp: boolean, grant: (role: string) => string[]): void {
  const purpose = 'Bills customers for what they bought. Owns invoices from draft to payment.';

  const terms = [
    'Invoice=A request for payment sent to a customer',
    'Issue=To make an invoice final and send it',
    'Cancel=To void an invoice before payment',
  ];

  step('generate', 'context', 'billing', '--classification', 'core', '--purpose', purpose, ...terms.flatMap(term));
  step('generate', 'aggregate', 'billing', 'Invoice');
  step('generate', 'entity', 'billing', 'InvoiceLine', ...term('Line=One billed item of an invoice'));
  step('g', 'vo', 'billing', 'Money', ...term('Money=An amount in a currency'));
  step('generate', 'domain-event', 'billing', 'Invoice', 'Issued');
  step('generate', 'domain-service', 'billing', 'Pricing', ...term('Price=What a customer pays for one item'));
  step('generate', 'repository', 'billing', 'Invoice');

  step(
    'generate',
    'command',
    'billing',
    'IssueInvoice',
    '--creates',
    '--aggregate',
    'Invoice',
    '--permission',
    'invoice.issue',
    ...grant('accountant'),
  );

  step('generate', 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel', ...grant('accountant'));

  step(
    'generate',
    'query',
    'billing',
    'SearchInvoices',
    '--permission',
    'invoice.search',
    '--search',
    ...grant('accountant'),
    ...term('Search=To show invoices to their customer'),
  );

  step('generate', 'port', 'billing', 'PaymentGateway');
  step('generate', 'adapter', 'billing', 'PaymentGateway');
  // An outside system the project simulates: answered in memory by an adapter of production code.
  step('generate', 'port', 'billing', 'ExchangeRates');
  step('generate', 'adapter', 'billing', 'ExchangeRates', '--kind', 'simulated');
  step('generate', 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');

  if (withHttp) {
    scaffoldBillingRoutes(step);
  }

  step('generate', 'integration-event', 'billing', 'Invoice', 'Issued');
  step('generate', 'integration-event', 'billing', 'Invoice', 'Issued', '--version', '2');
  step('generate', 'event-handler', 'billing', 'Invoice', 'Issued');
  step('generate', 'acl', 'billing', 'LegacyErp');

  // A prerequisite created on the way: the domain event does not exist yet. This one reacts once the command has committed.
  step(
    'generate',
    'event-handler',
    'billing',
    'Invoice',
    'MarkedAsPaid',
    '--phase',
    'after-commit',
    ...term('Mark=To record a status on an invoice'),
    ...term('Pay=To settle an invoice'),
  );

  scaffoldBillingJobs(step);
}

function scaffoldBillingRoutes(step: Step): void {
  step('generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');

  step(
    'generate',
    'route',
    'billing',
    'CancelInvoice',
    '--method',
    'DELETE',
    '--path',
    '/invoices/:invoiceId',
    '--command',
  );

  step('generate', 'route', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/invoices', '--query');
  step('generate', 'e2e', 'billing', 'IssueInvoice');
}

/**
 * A downstream context: one handler of a declared event and a gateway. Where the wiring is
 * written in a module file, also a handler of an event without a declaration and a second
 * adapter of the gateway port: a declared class needs the declaration of its event, and a token
 * takes one declared adapter.
 */
function scaffoldShipping(step: Step, declared: boolean): void {
  step(
    'generate',
    'context',
    'shipping',
    '--classification',
    'supporting',
    '--upstream',
    'billing:customer-supplier',
    ...term('Parcel=A package handed to a carrier'),
  );

  step('generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.issued');

  if (!declared) {
    step('generate', 'consumer', 'shipping', 'billing', 'billing.invoice.cancelled');
  }

  step('generate', 'gateway', 'shipping', 'billing', 'InvoiceStatus');

  if (!declared) {
    step('generate', 'adapter', 'shipping', 'InvoiceStatusGateway', '--kind', 'gateway');
  }

  step('generate', 'service', 'shipping');
  step('generate', 'adr', 'Keep shipping in the same repository as billing');
}

/** A context name in several words, a repository created by its command, a query behind a parameterised route. */
function scaffoldOrderFulfilment(step: Step, withHttp: boolean, grant: (role: string) => string[]): void {
  const terms = [
    'Purchase order=What a customer asked to receive',
    'Place=To submit a purchase order',
    'Track=To follow a purchase order',
  ];

  step('generate', 'context', 'order-fulfilment', '--classification', 'generic', ...terms.flatMap(term));
  step('generate', 'aggregate', 'order-fulfilment', 'PurchaseOrder');
  step('generate', 'builder', 'order-fulfilment', 'PurchaseOrder', '--force');
  step('generate', 'repository', 'order-fulfilment', 'PurchaseOrder', '--tenant-scoped');

  step(
    'generate',
    'command',
    'order-fulfilment',
    'PlacePurchaseOrder',
    '--creates',
    '--aggregate',
    'PurchaseOrder',
    '--permission',
    'purchase-order.place',
    ...grant('buyer'),
  );

  step('generate', 'query', 'order-fulfilment', 'TrackPurchaseOrder', '--public');

  if (!withHttp) {
    return;
  }

  step(
    'generate',
    'route',
    'order-fulfilment',
    'PlacePurchaseOrder',
    '--method',
    'PUT',
    '--path',
    '/purchase-orders/:purchaseOrderId',
  );

  step(
    'generate',
    'route',
    'order-fulfilment',
    'TrackPurchaseOrder',
    '--method',
    'GET',
    '--path',
    '/purchase-orders/:purchaseOrderId/tracking',
  );

  step('generate', 'e2e', 'order-fulfilment', 'TrackPurchaseOrder');
}

function must(result: CliResult, what: string): CliResult {
  if (result.code !== 0) {
    throw new Error(`${what} failed (${result.code}): ${result.stderr || result.stdout}`);
  }

  return result;
}

export const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
