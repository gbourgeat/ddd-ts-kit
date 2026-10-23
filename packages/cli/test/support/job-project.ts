import { expect } from 'vitest';
import { cli, tempDir } from '../helpers';

/** A project with a billing context, its terms, and the two commands a job of the specs sends. */
export function jobProject(...flags: string[]): string {
  const root = tempDir('job');

  expect(cli(root, 'init', ...flags).code).toBe(0);

  expect(
    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Cancel=To void an invoice',
      '--term',
      'Remind=To ask again for a payment',
    ).code,
  ).toBe(0);

  expect(cli(root, 'generate', 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel').code).toBe(0);
  expect(cli(root, 'generate', 'command', 'billing', 'RemindInvoices', '--public').code).toBe(0);

  return root;
}
