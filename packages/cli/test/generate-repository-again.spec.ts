import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { failure } from './reports';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';

const INVOICE = ['generate', 'repository', 'billing', 'Invoice'];

describe.each(['drizzle', 'knex', 'typeorm', 'prisma'])('generate repository, run again on %s', (orm) => {
  it('adds nothing with the same options, and refuses to declare the table again with others', () => {
    const root = billingWithPersonalInvoices(['--orm', orm]);
    const tables = tablesOf(root, orm);

    expectOk(cli(root, ...INVOICE, '--personal', 'customer_email,customer_name', '--json'));
    expect(tablesOf(root, orm)).toBe(tables);

    const refused = failure(cli(root, ...INVOICE, '--personal', 'customer_phone', '--json'));

    expect(refused.message).toMatch(
      /already declares the table invoices, with other columns than this command would write\.$/,
    );

    expect(tablesOf(root, orm)).toBe(tables);
  });
});

function tablesOf(root: string, orm: string): string {
  if (orm === 'prisma') {
    return read(root, 'prisma/schema/billing.prisma');
  }

  return read(
    root,
    `src/contexts/billing/infrastructure/persistence/${orm === 'knex' ? 'create-billing-tables' : 'billing'}.schema.ts`,
  );
}
