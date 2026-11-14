import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';
import {
  CONTEXTS,
  INDEX,
  regionOf,
  SETTLED_ON_DRIZZLE,
  sourceOf,
  storeBoth,
  storeJob,
  tablesOf,
  twoContextsOn,
} from './support/same-name-project';

describe('tables of the same name in two contexts, on Drizzle', () => {
  it('keeps the name of the table in each tables file and in what reads it: each is in the schema of its context', () => {
    const root = twoContextsOn('drizzle');

    for (const context of ['billing', 'shipping']) {
      expect(read(root, tablesOf(context))).toContain(
        `export const invoiceSummaries = ${context}Schema.table(\n  'invoice_summaries',`,
      );

      expect(read(root, tablesOf(context))).toContain(`export const parcels = ${context}Schema.table('parcels', {`);
    }

    expect(
      read(root, 'src/contexts/shipping/infrastructure/persistence/drizzle-invoice-summaries.repository.ts'),
    ).toContain(`import { invoiceSummaries } from '${sourceOf('shipping')}';`);
  });

  it('settles each name in the index: the context that held it first keeps it, the second exports its own under its context', () => {
    expect(regionOf(twoContextsOn('drizzle'), 'schemas')).toEqual(SETTLED_ON_DRIZZLE);
  });

  it('gives a third context its own name beside the two, and leaves alone a table no other context holds', () => {
    const root = twoContextsOn('drizzle');

    storeBoth(root, 'returns');
    expectOk(cli(root, 'generate', 'read-model', 'returns', 'RefundsToPay'));

    expect(regionOf(root, 'schemas')).toEqual([
      ...SETTLED_ON_DRIZZLE,
      `export * from '${sourceOf('returns')}';`,
      `export { invoiceSummaries as returnsInvoiceSummaries } from '${sourceOf('returns')}';`,
      `export { parcels as returnsParcels } from '${sourceOf('returns')}';`,
    ]);
  });

  it('lets a context listed first take the second name when the table comes to it second', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    expectOk(cli(root, 'generate', 'read-model', 'billing', 'Totals'));
    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'InvoiceSummaries'));
    expectOk(cli(root, 'generate', 'read-model', 'billing', 'InvoiceSummaries'));

    expect(regionOf(root, 'schemas').slice(2)).toEqual([
      `export { invoiceSummaries } from '${sourceOf('shipping')}';`,
      `export { invoiceSummaries as billingInvoiceSummaries } from '${sourceOf('billing')}';`,
    ]);
  });

  it('keeps the name the team gave by hand to the table of the second context', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);
    const byHand = `export { invoiceSummaries as summariesOfShipping } from '${sourceOf('shipping')}';`;

    expectOk(cli(root, 'generate', 'read-model', 'billing', 'InvoiceSummaries'));
    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'Totals'));
    write(root, INDEX, read(root, INDEX).replace('// /ddd-ts-kit:schemas', `${byHand}\n// /ddd-ts-kit:schemas`));
    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'InvoiceSummaries'));

    expect(regionOf(root, 'schemas').slice(2)).toEqual([
      byHand,
      `export { invoiceSummaries } from '${sourceOf('billing')}';`,
    ]);
  });

  it('says what to add by hand, and settles nothing, in an index that lost the region of its tables files', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    expectOk(cli(root, 'generate', 'read-model', 'billing', 'InvoiceSummaries'));
    write(root, INDEX, read(root, INDEX).replace(/^\/\/ \/?ddd-ts-kit:schemas\n/gm, ''));

    const generated = expectOk(cli(root, 'generate', 'read-model', 'shipping', 'InvoiceSummaries'));

    expect(generated.stdout).toContain(
      `has no "ddd-ts-kit:schemas" region: add this by hand:\nexport * from '${sourceOf('shipping')}';`,
    );

    expect(read(root, INDEX)).not.toContain('export {');
  });
});

describe('a table that bears the name of a table of the platform', () => {
  it('is exported under its context on Drizzle, where the constant of the index would hide it from the migrations', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    storeJob(root, 'billing');
    storeJob(root, 'billing');

    expect(read(root, INDEX)).toContain('export const jobs = jobsTable(MESSAGING_SCHEMA);');

    expect(regionOf(root, 'schemas')).toEqual([
      `export * from '${sourceOf('billing')}';`,
      `export { jobs as billingJobs } from '${sourceOf('billing')}';`,
    ]);
  });

  it('is imported under its context on TypeORM, and listed under it', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);

    storeJob(root, 'billing');

    expect(regionOf(root, 'imports')).toEqual([`import { jobs as billingJobs } from '${sourceOf('billing')}';`]);
    expect(regionOf(root, 'schemas')).toEqual(['billingJobs,']);
  });
});

describe('tables of the same name in two contexts, on TypeORM', () => {
  it('imports the entity of the second context under its context and lists both', () => {
    const root = twoContextsOn('typeorm');

    expect(regionOf(root, 'imports')).toEqual([
      `import { invoiceSummaries, parcels } from '${sourceOf('billing')}';`,
      'import {',
      'invoiceSummaries as shippingInvoiceSummaries,',
      'parcels as shippingParcels,',
      `} from '${sourceOf('shipping')}';`,
    ]);

    expect(regionOf(root, 'schemas')).toEqual([
      'invoiceSummaries,',
      'parcels,',
      'shippingInvoiceSummaries,',
      'shippingParcels,',
    ]);

    expect(read(root, tablesOf('shipping'))).toContain("  name: 'ShippingInvoiceSummaries',");
  });
});

describe('tables of the same name in two contexts, on Knex and Prisma', () => {
  it('needs no other name on Knex: the index calls one function per context', () => {
    expect(regionOf(twoContextsOn('knex'), 'schemas')).toEqual([
      'await createBillingTables(knex);',
      'await createShippingTables(knex);',
    ]);
  });

  it('needs no other name on Prisma: a model carries its context, in the database schema of its context', () => {
    const models = read(twoContextsOn('prisma'), 'prisma/schema/shipping.prisma');

    expect(models).toContain('model ShippingInvoiceSummaries {');
    expect(models).toContain('model ShippingParcel {');
    expect(models).toContain('  @@map("invoice_summaries")\n  @@schema("shipping")');
  });
});
