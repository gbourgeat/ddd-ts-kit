import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';

function repositoryOn(orm: string, file: string, ...flags: string[]): string {
  const root = initProject('--orm', orm, '--audit', 'off', '--context', 'billing:core', ...flags);

  cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');
  cli(root, 'generate', 'repository', 'billing', 'Invoice', '--allow-name');

  return read(root, `${PERSISTENCE}/${file}`);
}

describe('the first save of a generated repository', () => {
  it('ignores a conflict on the id alone on Drizzle, so that another unique value is refused by the database', () => {
    const repository = repositoryOn('drizzle', 'drizzle-invoice.repository.ts');

    expect(repository).toContain('insertion.onConflictDoNothing({ target: primaryKeyOf(invoices) });');
    expect(repository).not.toContain('onConflictDoNothing()');
  });

  it('ignores a conflict on the id alone on Knex', () => {
    expect(repositoryOn('knex', 'knex-invoice.repository.ts')).toContain("conflict: 'id',");
  });

  it.each([[[]], [['--tenancy', 'shared-table']]])(
    'tells a taken id from another unique value on Prisma, whose skipDuplicates names no target (%j)',
    (flags) => {
      const repository = repositoryOn('prisma', 'prisma-invoice.repository.ts', ...flags);

      expect(repository).toContain('return rowsCreated(created, {');
      expect(repository).toContain('skipDuplicates: true');
    },
  );
});
