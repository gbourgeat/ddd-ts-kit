import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, exists, read, type CliResult } from './helpers';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
const DECLARATION = `${PERSISTENCE}/invoice.personal-fields.ts`;
const SPEC = `${BILLING}/test/integration/billing-personal-data.spec.ts`;
const PERSONAL = ['--personal', 'customer_email,customer_name'];

describe('generate repository --retention: how long the rows keep what they hold of a person', () => {
  it('declares the retention from a date column it adds to the storage, and the spec proves the purge', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex'], [...PERSONAL, '--retention', 'ended_at:36m']);

    const declaration = read(root, DECLARATION);

    expect(declaration).toContain("  retention: { after: 'ended_at', months: 36 },\n};");

    expect(declaration).toContain(
      '  // TODO(domain): the mapper writes ended_at empty: write the date the relation with the person ended',
    );

    expect(read(root, `${PERSISTENCE}/create-billing-tables.schema.ts`)).toContain(
      "    table.text('customer_name');\n    table.timestamp('ended_at', { useTz: true });\n",
    );

    expect(read(root, `${PERSISTENCE}/invoice-row.schema.ts`)).toContain('  readonly ended_at: Date | null;\n');
    expect(read(root, `${PERSISTENCE}/invoice.mapper.ts`)).toContain('      ended_at: null,\n');

    const spec = read(root, SPEC);

    expect(spec).toContain(
      "describe('KnexBillingPersonalDataErasure, the purge of what outlived its retention', () => {",
    );

    expect(spec).toContain('    const ada = await saved({ ...OF_ADA, ended_at: LONG_AGO });');
    expect(spec).toContain('    expect(await erasure.purgeExpired(clock.now())).toBe(1);');
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('deletes the rows in the row mode once their retention ended, a row of another subject included', () => {
    const root = billingWithPersonalInvoices(
      ['--orm', 'knex'],
      [...PERSONAL, '--subject', 'customer_id', '--erasure', 'row', '--retention', 'closed_at:10y'],
    );

    expect(read(root, DECLARATION)).toContain("  retention: { after: 'closed_at', years: 10 },");

    expect(read(root, `${PERSISTENCE}/create-billing-tables.schema.ts`)).toContain(
      "    table.timestamp('closed_at', { useTz: true });\n",
    );

    expect(read(root, SPEC)).toContain('    expect(await rowOf(ada)).toBeUndefined();');
  });

  it('spells the date column as each ORM reads it, and adds it to each storage as a nullable timestamp', () => {
    const drizzle = billingWithPersonalInvoices([], [...PERSONAL, '--retention', 'ended_at:30d']);
    const prisma = billingWithPersonalInvoices(['--orm', 'prisma'], [...PERSONAL, '--retention', 'ended_at:3y']);
    const typeorm = billingWithPersonalInvoices(['--orm', 'typeorm'], [...PERSONAL, '--retention', 'ended_at:12m']);

    expect(read(drizzle, DECLARATION)).toContain("  retention: { after: 'endedAt', days: 30 },");

    expect(read(drizzle, `${PERSISTENCE}/billing.schema.ts`)).toContain(
      "  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),",
    );

    expect(read(prisma, DECLARATION)).toContain("  retention: { after: 'ended_at', years: 3 },");
    expect(read(prisma, 'prisma/schema.prisma')).toContain('  endedAt DateTime? @map("ended_at") @db.Timestamptz(3)');
    expect(read(prisma, SPEC)).toContain('    const ada = await saved({ ...OF_ADA, endedAt: LONG_AGO });');
    expect(read(typeorm, DECLARATION)).toContain("  retention: { after: 'endedAt', months: 12 },");

    expect(read(typeorm, `${PERSISTENCE}/billing.schema.ts`)).toContain(
      "    endedAt: { name: 'ended_at', type: 'timestamptz', nullable: true },",
    );
  });
});

describe('what --retention refuses before anything is written', () => {
  const refused = (root: string, ...flags: string[]): CliResult => {
    const result = cli(root, 'generate', 'repository', 'billing', 'Invoice', ...flags);

    expect(result.code).not.toBe(0);
    expect(exists(root, DECLARATION)).toBe(false);

    return result;
  };

  it('a period that is not one, a column that is personal or the subject, a column of the table, registered_at, a retention alone', () => {
    const root = initProject('--orm', 'knex');

    expectOk(
      cli(
        root,
        'generate',
        'context',
        'billing',
        '--classification',
        'core',
        '--purpose',
        'Bills.',
        '--term',
        'Invoice=A bill',
      ),
    );

    expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice'));

    expect(refused(root, ...PERSONAL, '--retention', 'ended_at').stderr).toContain('is not a retention');
    expect(refused(root, ...PERSONAL, '--retention', 'ended_at:0m').stderr).toContain('is not a retention');
    expect(refused(root, ...PERSONAL, '--retention', 'ended_at:3w').stderr).toContain('is not a retention');

    expect(refused(root, ...PERSONAL, '--retention', 'customer_email:3y').stderr).toContain(
      'named by --personal or --subject',
    );

    expect(refused(root, ...PERSONAL, '--retention', 'version:3y').stderr).toContain('keeps for its own needs');

    // Counted from the registration, the nightly purge would erase people who are still customers.
    expect(refused(root, ...PERSONAL, '--retention', 'registered_at:5y').stderr).toContain(
      'never from its beginning: counted from registered_at, the nightly purge would erase people who are still customers',
    );

    expect(refused(root, '--retention', 'ended_at:3y').stderr).toContain('go with --personal');
  });
});
