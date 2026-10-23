import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';
const EVENT = `${BILLING}/domain/events/invoice-issued.event.ts`;
const HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const CONSUMER = `${SHIPPING}/application/integration/handlers/billing-invoice-issued.integration-handler.ts`;
const UNITS = { billing: `${BILLING}/test/unit`, shipping: `${SHIPPING}/test/unit` };

/** Generated again from scratch: the file and its spec removed first. */
function removed(...files: string[]): void {
  for (const file of files) {
    fs.rmSync(path.join(root, file), { force: true });
  }
}

let root: string;

beforeAll(() => {
  root = tempDir('event-names');

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
    ['generate', 'domain-event', 'billing', 'Invoice', 'Issued'],
    ['generate', 'integration-event', 'billing', 'Invoice', 'Issued'],
  ];

  for (const step of steps) {
    expect(cli(root, ...step).stderr, step.join(' ')).toBe('');
  }
});

describe('the name of a domain event', () => {
  it('is declared once by the event class, and read by the reactions', () => {
    expect(read(root, EVENT)).toContain(
      "export class InvoiceIssued extends NamedDomainEvent('billing.invoice.issued') {\n",
    );

    expect(cli(root, 'generate', 'event-handler', 'billing', 'Invoice', 'Issued').code).toBe(0);
    expect(read(root, HANDLER)).toContain('@DomainEventHandler(InvoiceIssued)\n');
  });

  it('is declared first when an event class 0.5 wrote declares no eventName, before a reaction is attached under it', () => {
    write(
      root,
      EVENT,
      read(root, EVENT).replace(
        "extends NamedDomainEvent('billing.invoice.issued') {",
        "{\n  readonly name = 'billing.invoice.issued';",
      ),
    );

    removed(HANDLER, `${UNITS.billing}/invoice-issued.event-handler.spec.ts`);
    const refused = cli(root, 'generate', 'event-handler', 'billing', 'Invoice', 'Issued');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain("write `static readonly eventName = 'billing.invoice.issued';`");
    expect(fs.existsSync(path.join(root, HANDLER))).toBe(false);
  });
});

describe('the type an integration event handler handles', () => {
  it('is read from the declaration of its upstream', () => {
    expect(cli(root, 'generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.issued').code).toBe(0);
    expect(read(root, CONSUMER)).toContain('static readonly eventType = invoiceIssuedV1.type;');
  });

  it('stays written out where the event catalog script of the project reads it written out', () => {
    write(root, 'scripts/events.ts', read(root, 'scripts/events.ts').replaceAll('typesByName', 'knownTypes'));

    removed(CONSUMER, `${UNITS.shipping}/billing-invoice-issued.integration-handler.spec.ts`);
    expect(cli(root, 'generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.issued').code).toBe(0);

    expect(read(root, CONSUMER)).toContain("static readonly eventType = 'billing.invoice.issued';");
  });
});
