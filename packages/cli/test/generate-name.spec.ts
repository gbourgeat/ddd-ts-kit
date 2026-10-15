import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support.js';
import { cli, exists, read, scaffoldEverything, tempDir } from './helpers.js';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

let root: string;

beforeAll(() => {
  root = tempDir('generate-name');
  scaffoldEverything(root);
});

describe('generate takes --name for a handler its event would name otherwise', () => {
  it('names an integration handler as the design calls it, with its spec and its consumer', () => {
    const result = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued',
      '--name',
      'PrepareParcelIntegrationHandler',
      '--term',
      'Prepare=To get a parcel ready for the carrier',
    );

    expect(result.code).toBe(0);

    const handler = read(root, `${SHIPPING}/application/integration/handlers/prepare-parcel.integration-handler.ts`);

    expect(handler).toContain('export class PrepareParcelIntegrationHandler');
    expect(handler).toContain("'shipping.prepare-parcel'");

    expect(read(root, `${SHIPPING}/test/unit/prepare-parcel.integration-handler.spec.ts`)).toContain(
      "expect(PrepareParcelIntegrationHandler.eventType).toBe('billing.invoice.issued');",
    );
  });

  it('keeps the name read from the event without --name', () => {
    expect(
      exists(root, `${SHIPPING}/application/integration/handlers/billing-invoice-issued.integration-handler.ts`),
    ).toBe(true);
  });

  it('names a second reaction to one domain event, beside the first', () => {
    const result = cli(
      root,
      'generate',
      'event-handler',
      'billing',
      'Invoice',
      'Issued',
      '--name',
      'remind-customer',
      '--term',
      'Remind=To tell a customer again what is due',
      '--term',
      'Customer=Who an invoice is sent to',
    );

    expect(result.code).toBe(0);

    const handler = read(root, `${BILLING}/application/event-handlers/remind-customer.event-handler.ts`);

    expect(handler).toContain('export class RemindCustomerEventHandler');
    expect(handler).toContain('InvoiceIssued');

    expect(read(root, `${BILLING}/test/unit/remind-customer.event-handler.spec.ts`)).toContain(
      'new RemindCustomerEventHandler()',
    );

    expect(exists(root, `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`)).toBe(true);
  });

  it('writes handlers that check finds nothing to say about', () => {
    const named = checkJsonOf(cli(root, 'check', '--json')).violations.filter((violation) =>
      /prepare-parcel|remind-customer/.test(violation.file),
    );

    expect(named).toEqual([]);
  });

  it('refuses a name in words the glossary does not define, as for any concept', () => {
    const result = cli(root, 'generate', 'event-handler', 'billing', 'Invoice', 'Issued', '--name', 'Frobnicate');

    expect(result.code).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('which the glossary of');
  });
});
