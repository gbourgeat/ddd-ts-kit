import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const COLUMNS = 'add one field per field of InvoiceState';

/** A project of the given ORM with a billing context, its Invoice aggregate and its repository, and a shipping context. */
function billingWithInvoices(orm: string): string {
  const root = initProject('--context', 'billing:core', '--context', 'shipping:supporting', '--orm', orm);

  expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment'));
  expectOk(cli(root, 'generate', 'repository', 'billing', 'Invoice'));

  return root;
}

describe('todo reads the markers of every kind of file the generators write, not only TypeScript', () => {
  it('lists the TODO(domain) the repository left in prisma/schema.prisma, under the context of its model', () => {
    const root = billingWithInvoices('prisma');

    const line =
      read(root, 'prisma/schema.prisma')
        .split('\n')
        .findIndex((text) => text.includes(COLUMNS)) + 1;

    expect(line).toBeGreaterThan(0);
    expect(cli(root, 'todo', 'billing').stdout).toContain(`prisma/schema.prisma:${line}  TODO(domain)  ${COLUMNS}`);
    expect(cli(root, 'todo', 'shipping').stdout).not.toContain('prisma/schema.prisma');

    expect(jsonAt(cli(root, 'todo', '--json').json(), 'remaining')).toContainEqual(
      expect.objectContaining({ kind: 'domain', context: 'billing', file: 'prisma/schema.prisma', line }),
    );
  });

  it('lists, in the whole project, a marker of a migration, of the configuration at the root and of a page', () => {
    const root = billingWithInvoices('prisma');

    write(
      root,
      'prisma/migrations/20261027000000_add_invoices/migration.sql',
      '-- TODO(platform): index the due date.\n',
    );

    write(root, 'docker-compose.yml', `${read(root, 'docker-compose.yml')}# TODO(platform): pin the image.\n`);
    write(root, 'docs/adr/0001-pricing.md', '# Pricing\n\nTODO(review): say who decided.\n');

    const remaining = jsonAt(cli(root, 'todo', '--json').json(), 'remaining');

    expect(remaining).toContainEqual(
      expect.objectContaining({
        kind: 'platform',
        context: '',
        file: 'prisma/migrations/20261027000000_add_invoices/migration.sql',
        text: 'index the due date.',
      }),
    );

    expect(remaining).toContainEqual(
      expect.objectContaining({ kind: 'platform', file: 'docker-compose.yml', text: 'pin the image.' }),
    );

    expect(remaining).toContainEqual(
      expect.objectContaining({ kind: 'review', file: 'docs/adr/0001-pricing.md', line: 3 }),
    );

    expect(cli(root, 'todo', 'billing').stdout).not.toContain('docker-compose.yml');
  });

  it('lists the column marker of the other ORMs in the tables file of the context, as with Prisma', () => {
    const root = billingWithInvoices('drizzle');

    expect(cli(root, 'todo', 'billing').stdout).toMatch(
      /^src\/contexts\/billing\/infrastructure\/persistence\/billing\.schema\.ts:\d+ {2}TODO\(domain\)/m,
    );
  });
});
