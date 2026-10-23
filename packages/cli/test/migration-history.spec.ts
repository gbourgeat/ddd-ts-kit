import { describe, expect, it } from 'vitest';
import { drizzleHistoryFindings } from '../src/check/migrations/drizzle-history-findings';
import { migrationNameFindings } from '../src/check/migrations/migration-name-findings';
import { readDrizzleMigrations } from '../src/check/migrations/read-drizzle-migrations';
import { readMigrationFolder } from '../src/check/migrations/read-migration-folder';
import { workingMigrationFindings } from '../src/check/migrations/working-migration-findings';
import { tempDir, write } from './helpers';

const ORIGIN = '00000000-0000-0000-0000-000000000000';

describe('the drizzle-kit history that persistence/migration-history reads', () => {
  it('follows the out folder of drizzle.config.ts and reports an entry without its file and a file without its entry', () => {
    const root = tempDir('history');

    write(root, 'drizzle.config.ts', "export default { out: './db/migrations/' };\n");

    write(
      root,
      'db/migrations/meta/_journal.json',
      journal([
        ['20261010120000_initial', 1],
        ['20261011120000_lost', 2],
      ]),
    );

    write(root, 'db/migrations/20261010120000_initial.sql', 'SELECT 1;\n');
    write(root, 'db/migrations/20261012120000_by-hand.sql', 'SELECT 2;\n');

    const migrations = readDrizzleMigrations(root);
    const messages = drizzleHistoryFindings(migrations ?? fail()).map((finding) => finding.message);

    expect(migrations?.folder).toBe('db/migrations');

    expect(messages).toEqual([
      'The journal lists the migration "20261011120000_lost" but db/migrations/20261011120000_lost.sql does not exist.',
      'db/migrations/20261012120000_by-hand.sql is not in the journal: drizzle-kit migrate never applies it.',
    ]);
  });

  it('reports an index that is not the position of the entry, and reads no history without a journal', () => {
    const root = tempDir('history');

    write(root, 'migrations/meta/_journal.json', journal([['0000_initial', 1]], 3));
    write(root, 'migrations/0000_initial.sql', 'SELECT 1;\n');
    write(root, 'migrations/meta/0000_snapshot.json', JSON.stringify({ id: 'a', prevId: ORIGIN }));

    const findings = drizzleHistoryFindings(readDrizzleMigrations(root) ?? fail());

    expect(findings.map((finding) => finding.message)).toEqual([
      'The journal entry "0000_initial" is out of order (idx 3 at position 0): a database that applied a later migration skips it without a word.',
    ]);

    expect(readDrizzleMigrations(tempDir('history'))).toBeUndefined();
  });
});

describe('the names of the migrations', () => {
  it('lists the migrations of each tool where it writes them', () => {
    const root = tempDir('names');

    write(root, 'prisma/migrations/20261012093000_add_invoices/migration.sql', 'SELECT 1;\n');
    write(root, 'prisma/migrations/migration_lock.toml', 'provider = "postgresql"\n');
    write(root, 'migrations/1791829645467-add-invoices.ts', 'export {};\n');
    write(root, 'migrations/1791829645467-add-invoices.d.ts', 'export {};\n');

    expect(readMigrationFolder(root, 'prisma')?.migrations).toEqual([
      {
        name: '20261012093000_add_invoices',
        file: 'prisma/migrations/20261012093000_add_invoices/migration.sql',
      },
    ]);

    expect(readMigrationFolder(root, 'typeorm')?.migrations.map((migration) => migration.name)).toEqual([
      '1791829645467-add-invoices',
    ]);

    expect(readMigrationFolder(root, 'custom')).toBeUndefined();
  });

  it('accepts a number and a description, and reports a missing number and a shared one', () => {
    const named = (...names: string[]) => names.map((name) => ({ name, file: `migrations/${name}.js` }));

    expect(migrationNameFindings(named('0001_initial', '20261012093000_add-invoices'))).toEqual([]);

    expect(
      migrationNameFindings(named('add-invoices', '0002_a', '0002_b')).map(([migration]) => migration.name),
    ).toEqual(['add-invoices', '0002_b']);
  });

  it('knows a working migration as each tool writes its name, and nothing else', () => {
    const named = (...names: string[]) => names.map((name) => ({ name, file: `migrations/${name}` }));

    const working = named(
      '20261015101500_working-add-claims',
      '20261015101500_working_add_claims',
      '1791829645467-working-add-claims',
    );

    expect(workingMigrationFindings(working).map(([migration]) => migration.name)).toEqual(
      working.map((migration) => migration.name),
    );

    expect(workingMigrationFindings(named('20261015101500_add-working-hours', '20261015101500_workings'))).toEqual([]);
  });
});

function journal(tags: readonly (readonly [tag: string, when: number])[], firstIdx = 0): string {
  const entries = tags.map(([tag, when], index) => ({ idx: firstIdx + index, version: '7', when, tag }));

  return JSON.stringify({ version: '7', dialect: 'postgresql', entries });
}

function fail(): never {
  throw new Error('The journal was not read.');
}
