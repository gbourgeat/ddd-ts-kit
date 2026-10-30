import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cli, EXPLICIT_STACK, read, tempDir, write } from './helpers';
import { initFlags } from './support/init-flags';

const SHIPPING = 'src/contexts/shipping';
const HANDLERS = `${SHIPPING}/application/integration/handlers`;

let root: string;

beforeAll(() => {
  root = tempDir('integration-handler-version');

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
      '--term',
      'Billing=A word of the handlers',
      '--term',
      'Invoice=A word of the handlers',
      '--term',
      'Issued=A word of the handlers',
      '--term',
      'One=A word of the handlers',
      '--term',
      'Two=A word of the handlers',
      '--term',
      'Three=A word of the handlers',
      '--term',
      'Newest=A word of the handlers',
      '--term',
      'Both=A word of the handlers',
      '--term',
      'Queue=A line of parcels',
    ],
    ['generate', 'aggregate', 'billing', 'Invoice'],
    ['generate', 'integration-event', 'billing', 'Invoice', 'Issued'],
    ['generate', 'integration-event', 'billing', 'Invoice', 'Issued', '--version', '2'],
  ];

  for (const step of steps) {
    expect(cli(root, ...step).stderr, step.join(' ')).toBe('');
  }
});

describe('generate integration-handler, given the type as `list` prints it', () => {
  it('reads the version the type names, and writes the handler of that version', () => {
    const written = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued@v1',
      '--name',
      'On Invoice Issued One',
    );

    expect(written.stderr).toBe('');
    expect(written.code).toBe(0);

    const handler = read(root, `${HANDLERS}/on-invoice-issued-one.integration-handler.ts`);

    expect(handler).toContain('invoiceIssuedV1');
    expect(handler).not.toContain('invoiceIssuedV2');
  });

  it('reads the newest version of a bare type, as before', () => {
    const written = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued',
      '--name',
      'On Invoice Issued Newest',
    );

    expect(written.code).toBe(0);
    expect(read(root, `${HANDLERS}/on-invoice-issued-newest.integration-handler.ts`)).toContain('invoiceIssuedV2');
  });

  it('accepts --version beside a suffix that says the same', () => {
    const written = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued@v2',
      '--version',
      '2',
      '--name',
      'On Invoice Issued Two',
    );

    expect(written.code).toBe(0);
    expect(read(root, `${HANDLERS}/on-invoice-issued-two.integration-handler.ts`)).toContain('invoiceIssuedV2');
  });

  it('refuses a version that is not published, naming the ones that are', () => {
    const refused = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued@v3',
      '--name',
      'On Invoice Issued Three',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('billing.invoice.issued is published at v1, v2 only.');
  });

  it('refuses a suffix and a --version that name two versions, naming both', () => {
    const refused = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued@v2',
      '--version',
      '1',
      '--name',
      'On Invoice Issued Both',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('names version 2 and --version 1 names another');
  });

  it('refuses a version that is not a number', () => {
    const refused = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued@latest',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('"latest" is not a valid version.');
  });
});

const PAID = `export const invoicePaidV1 = defineIntegrationEvent({
  type: 'billing.invoice.paid',
  version: 1,
  payload: schema,
});

export type InvoicePaidV1 = IntegrationEvent<InvoicePaidV1Payload>;

export const invoicePaidV2 = defineIntegrationEvent({
  type: 'billing.invoice.paid',
  version: 2,
  payload: schema,
});

export type InvoicePaidV2 = IntegrationEvent<InvoicePaidV2Payload>;
`;

describe('a published language that declares two versions in one file', () => {
  it('lets a handler read the second one, and names both when a third is asked for', () => {
    write(root, 'src/contexts/billing/published-language/invoice-paid.integration-event.ts', PAID);

    const written = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.paid@v2',
      '--term',
      'Paid=Settled',
      '--name',
      'On Invoice Paid Two',
    );

    expect(written.stderr).toBe('');
    expect(read(root, `${HANDLERS}/on-invoice-paid-two.integration-handler.ts`)).toContain('invoicePaidV2');

    const refused = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.paid@v3',
      '--name',
      'On Invoice Paid Three',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('billing.invoice.paid is published at v1, v2 only.');
  });
});

describe('a version that no declaration of the upstream matches', () => {
  it('is refused in a declared project, with the command that declares it at that version', () => {
    const refused = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.refunded@v2',
      '--term',
      'Refunded=Paid back',
      '--name',
      'On Invoice Refunded',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('billing declares no billing.invoice.refunded at v2 in its published language.');
    expect(refused.stderr).toContain('generate integration-event billing Invoice Refunded --version 2');
    expect(fs.existsSync(path.join(root, `${HANDLERS}/on-invoice-refunded.integration-handler.ts`))).toBe(false);
  });

  it('is refused in a project that does not declare, and no handler is written at version 1', () => {
    const explicit = tempDir('integration-handler-version-explicit');

    for (const step of [
      ['init', ...initFlags(EXPLICIT_STACK)],
      ['generate', 'context', 'billing', '--classification', 'core', '--term', 'Invoice=A request for payment'],
      [
        'generate',
        'context',
        'shipping',
        '--classification',
        'supporting',
        '--upstream',
        'billing:customer-supplier',
        '--term',
        'Parcel=What leaves',
        '--term',
        'Invoice=A request for payment',
        '--term',
        'Issued=Made final',
      ],
    ]) {
      expect(cli(explicit, ...step).stderr, step.join(' ')).toBe('');
    }

    const refused = cli(
      explicit,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued@v2',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('billing declares no billing.invoice.issued at v2');
    expect(refused.stderr).toContain('--version 2');
    expect(fs.existsSync(path.join(explicit, `${HANDLERS}/billing-invoice-issued.integration-handler.ts`))).toBe(false);
  });
});

describe('generate projection, given the type as `list` prints it', () => {
  it('pins the version the type names', () => {
    const written = cli(root, 'generate', 'projection', 'shipping', 'Parcel Queue', 'billing.invoice.issued@v1');

    expect(written.stderr).toBe('');

    expect(read(root, `${SHIPPING}/application/projections/parcel-queue.projection.ts`)).toContain(
      '@On(invoiceIssuedV1)',
    );
  });

  it('refuses a version that is not published, naming the ones that are', () => {
    const refused = cli(root, 'generate', 'projection', 'shipping', 'Parcel Queue', 'billing.invoice.issued@v3');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('billing.invoice.issued is published at v1, v2 only.');
  });

  it('refuses a version that is not a number', () => {
    const refused = cli(root, 'generate', 'projection', 'shipping', 'Parcel Queue', 'billing.invoice.issued@next');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('"next" is not a valid version.');
  });
});
