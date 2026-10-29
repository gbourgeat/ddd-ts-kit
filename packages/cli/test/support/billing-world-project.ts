import { expect } from 'vitest';
import { cli, tempDir } from '../helpers';
import { report } from '../reports';

export const BILLING = 'src/contexts/billing';
export const UNIT = `${BILLING}/test/unit`;
export const WORLD = `${BILLING}/test/worlds/billing.world.ts`;
export const WORLD_IMPORT = "import { aBillingWorld } from '@/contexts/billing/test/worlds/billing.world';";

const TERMS = [
  'Invoice=A request for payment sent to a customer',
  'Issue=To make an invoice final and send it',
  'Cancel=To void an invoice before payment',
  'Get=To read one invoice',
  'View=To look at one invoice',
  'Search=To look for invoices',
  'Overdue=Not paid after its due date',
  'Remind=To tell a customer an invoice is due',
  'Refund=Money paid back to a customer',
  'Approve=To accept a refund',
].flatMap((row) => ['--term', row]);

/** `init` with `flags`, then billing with the aggregate Invoice; `run` fails the spec on a refusal and answers the report. */
export function billingProject(label: string, ...flags: string[]) {
  const root = tempDir(label);

  const run = (...args: string[]) => {
    const result = cli(root, ...args, '--json');

    expect(result.code, `${args.join(' ')}\n${result.stdout}`).toBe(0);

    return report(result);
  };

  run('init', '--authz', 'rbac', ...flags);
  run('generate', 'context', 'billing', '--classification', 'core', ...TERMS);
  run('generate', 'aggregate', 'billing', 'Invoice');

  return { root, run };
}

/** The notes about the world of billing: the hint of `generate test-world`, or what the world lacks or hides. */
export const hint = (notes: readonly string[]): string[] =>
  notes.filter((note) => note.includes('generate test-world billing') || note.includes('world of billing'));

export const CANCEL = [
  'generate',
  'command',
  'billing',
  'CancelInvoice',
  '--aggregate',
  'Invoice',
  '--permission',
  'invoice.cancel',
];

export const ISSUE = [
  'generate',
  'command',
  'billing',
  'IssueInvoice',
  '--aggregate',
  'Invoice',
  '--creates',
  '--permission',
  'invoice.issue',
];

export const SEARCH = ['generate', 'query', 'billing', 'SearchInvoices', '--search', '--permission', 'invoice.search'];

export const APPROVE = [
  'generate',
  'command',
  'billing',
  'ApproveRefund',
  '--aggregate',
  'Refund',
  '--permission',
  'refund.approve',
];

export const REMIND = ['generate', 'job', 'billing', 'RemindOverdue', '--every', '1d', '--command', 'CancelInvoice'];
