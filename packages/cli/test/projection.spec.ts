import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, EXPLICIT_STACK, read, scaffoldEverything, tempDir } from './helpers';
import { failure, report } from './reports';

const SHIPPING = 'src/contexts/shipping';
const PROJECTION = `${SHIPPING}/application/projections/invoices-to-ship.projection.ts`;
const SPEC = `${SHIPPING}/test/unit/invoices-to-ship.projection.spec.ts`;

let root: string;

beforeAll(() => {
  root = tempDir('projection');
  scaffoldEverything(root);
});

describe('generate projection', () => {
  it('writes a projector of an event of a declared upstream and its spec, in the canonical place, and exports it from the declarations of its layer', () => {
    const generated = report(
      cli(root, 'generate', 'projection', 'shipping', 'InvoicesToShip', 'billing.invoice.issued', '--json'),
    );

    expect(generated.created).toEqual([PROJECTION, SPEC]);
    expect(generated.updated).toContain(`${SHIPPING}/application/application.declarations.ts`);

    expect(read(root, PROJECTION)).toContain(
      "@Projection('shipping.invoices-to-ship')\nexport class InvoicesToShipProjection {\n  @On(invoiceIssuedV2)\n  async issued(event: InvoiceIssuedV2): Promise<void> {",
    );

    expect(read(root, PROJECTION)).toContain(
      "import { invoiceIssuedV2, type InvoiceIssuedV2 } from '@/contexts/billing/published-language';",
    );

    expect(read(root, SPEC)).toContain('await expect(projection.issued(event)).resolves.toBeUndefined();');

    expect(read(root, `${SHIPPING}/application/application.declarations.ts`)).toContain(
      "export * from '@/contexts/shipping/application/projections/invoices-to-ship.projection';",
    );

    expect(generated.todos.map((todo) => todo.file)).toContain(PROJECTION);
  });

  it('is a role of the canonical tree: the directory, the suffix and the spec are held like the others, with no recorded deviation', () => {
    const checked = checkJsonOf(cli(root, 'check', '--json'));

    expect(checked.violations.filter(({ file }) => file.includes('projection'))).toEqual([]);
    expect(read(root, 'ddd-ts-kit.config.json')).not.toContain('extraDirectories');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('is listed by describe and in the reference of CONTEXT.md, with the events it applies', () => {
    const described = cli(root, 'describe', 'shipping', '--json').json();

    expect(described).toMatchObject({
      projections: [
        {
          name: 'shipping.invoices-to-ship',
          projector: 'InvoicesToShipProjection',
          applies: ['invoiceIssuedV2'],
          file: PROJECTION,
        },
      ],
    });

    expect(cli(root, 'describe', 'shipping').stdout).toContain(
      'shipping.invoices-to-ship (InvoicesToShipProjection, applies invoiceIssuedV2)',
    );

    expect(read(root, `${SHIPPING}/CONTEXT.md`)).toContain(
      '### Projections\n\n| Projection | Class | Applies |\n|---|---|---|\n| `shipping.invoices-to-ship` | `InvoicesToShipProjection` | `invoiceIssuedV2` |',
    );
  });

  it('applies an event of its own context too, and refuses a context that is not an upstream, an event nobody declares and a type that is none', () => {
    const own = cli(root, 'generate', 'projection', 'billing', 'IssuedInvoices', 'billing.invoice.issued', '--dry-run');
    const refused = (...args: string[]) => failure(cli(root, 'generate', 'projection', ...args, '--json'));

    expect(own.code).toBe(0);

    expect(refused('billing', 'Parcels', 'shipping.parcel.sent').message).toBe(
      '"billing" does not declare "shipping" as an upstream.',
    );

    expect(refused('shipping', 'PaidInvoices', 'billing.invoice.paid')).toMatchObject({
      message: 'billing declares no billing.invoice.paid in its published language.',
      fix: expect.stringContaining('ddd-ts-kit generate integration-event billing Invoice Paid'),
    });

    expect(refused('shipping', 'PaidInvoices', 'InvoicePaid').message).toBe(
      '"InvoicePaid" is not the type of an integration event.',
    );
  });

  it('in the explicit style keeps the declarations of the class and includes it in the module file of its context', () => {
    const explicit = tempDir('projection-explicit');

    scaffoldEverything(explicit, EXPLICIT_STACK);

    const generated = report(
      cli(explicit, 'generate', 'projection', 'shipping', 'InvoicesToShip', 'billing.invoice.issued', '--json'),
    );

    expect(generated.created).toEqual([PROJECTION, SPEC]);
    expect(generated.updated).toContain(`${SHIPPING}/shipping.module.ts`);
    expect(read(explicit, PROJECTION)).toContain("@Projection('shipping.invoices-to-ship')");

    const module = read(explicit, `${SHIPPING}/shipping.module.ts`);

    expect(module).toContain(
      "import { InvoicesToShipProjection } from '@/contexts/shipping/application/projections/invoices-to-ship.projection';",
    );

    expect(module).toContain('builder.include(InvoicesToShipProjection);');
    expect(read(explicit, SPEC)).toContain('await expect(projection.issued(event)).resolves.toBeUndefined();');

    expect(
      checkJsonOf(cli(explicit, 'check', '--json')).violations.filter(({ file }) => file.includes('projection')),
    ).toEqual([]);
  });

  it('on a platform wired by hand writes a plain class and subscribes it under its consumer name in the module function', () => {
    const manual = tempDir('projection-manual');

    scaffoldEverything(manual, {
      http: 'fastify',
      validation: 'class-validator',
      di: 'manual',
      tests: 'vitest',
      orm: 'knex',
      events: 'outbox',
    });

    const generated = report(
      cli(manual, 'generate', 'projection', 'shipping', 'InvoicesToShip', 'billing.invoice.issued', '--json'),
    );

    expect(generated.created).toEqual([PROJECTION, SPEC]);
    expect(read(manual, PROJECTION)).not.toContain('@Projection');
    expect(read(manual, PROJECTION)).toContain('export class InvoicesToShipProjection {\n  async issued(');

    const module = read(manual, `${SHIPPING}/shipping.module.ts`);

    expect(module).toContain('const invoicesToShipProjection = new InvoicesToShipProjection();');
    expect(module).toContain("consumer: 'shipping.invoices-to-ship',");
    expect(module).toContain('invoicesToShipProjection.issued(event)');
  });
});
