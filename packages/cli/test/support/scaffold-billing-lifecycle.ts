import type { StackFlags } from './stack-flags';

const term = (row: string): string[] => ['--term', row];

/** The lifecycle of an invoice, and, where the kernel module runs a queue, a background job and a process manager. */
export function scaffoldBillingLifecycle(step: (...args: string[]) => void, stack: StackFlags): void {
  const states = ['--value', 'draft', '--value', 'issued', '--value', 'cancelled'];
  const transitions = ['--transition', 'issue:draft>issued', '--transition', 'cancel:draft,issued>cancelled'];

  step('generate', 'state-machine', 'billing', 'Invoice', ...states, ...transitions);

  if (stack.di !== 'tsyringe') {
    return;
  }

  step(
    'generate',
    'background-job',
    'billing',
    'CompileOverdueStatements',
    '--command',
    'CancelInvoice',
    ...term('Compile=To gather the invoices of a period'),
    ...term('Overdue=Not paid by its due date'),
    ...term('Statement=What a customer owes at the end of a month'),
  );

  // A long name on purpose: what the templates write has to fit the line width of the formatter.
  step('generate', 'process', 'billing', 'OverdueInvoiceDunning', ...term('Dunning=Asking a customer to pay, again'));
}
