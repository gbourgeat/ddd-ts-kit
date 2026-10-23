import { expect } from 'vitest';
import { cli, scaffoldEverything, tempDir } from '../helpers.js';

export const BILLING = 'src/contexts/billing';
export const PURPOSE = 'The invoices from their draft to their payment.';

let generating: string | undefined;

/** One generated project whose billing declares the module invoices, shared by the specs of one file that generate into it. */
export function projectWithModule(): string {
  if (generating === undefined) {
    generating = tempDir('modules-generate');
    scaffoldEverything(generating);
    expect(cli(generating, 'generate', 'module', 'billing', 'invoices', '--purpose', PURPOSE).code).toBe(0);
  }

  return generating;
}
