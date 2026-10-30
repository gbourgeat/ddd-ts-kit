import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir } from './helpers';

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
    expect(refused.stderr).toContain('"billing.invoice.issued@latest" is not a valid version.');
  });
});
