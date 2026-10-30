import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

const EVENT = 'src/contexts/billing/published-language/invoice-issued.v1.integration-event.ts';

let root: string;

beforeAll(() => {
  root = tempDir('integration-handler-unexported');

  const steps = [
    ['init'],
    [
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Issue=To make it final',
    ],
    [
      'generate',
      'context',
      'shipping',
      '--classification',
      'supporting',
      '--upstream',
      'billing:customer-supplier',
      '--term',
      'Parcel=What leaves the warehouse',
    ],
    ['generate', 'aggregate', 'billing', 'Invoice'],
    ['generate', 'integration-event', 'billing', 'Invoice', 'Issued'],
  ];

  for (const step of steps) {
    expect(cli(root, ...step).stderr, step.join(' ')).toBe('');
  }

  const file = path.join(root, EVENT);

  fs.writeFileSync(
    file,
    fs.readFileSync(file, 'utf8').replace('export type InvoiceIssuedV1 =', 'type InvoiceIssuedV1 ='),
  );
});

describe('generate integration-handler on a version declared without an exported type', () => {
  it('refuses the version it was asked for, saying what to export, and never takes another', () => {
    const refused = cli(root, 'generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.issued@v1');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('billing.invoice.issued@v1 is declared without an exported event type to import.');
  });
});
