import { isWorkingMigration } from '../../check/migrations/is-working-migration';
import type { Migration } from '../../check/migrations/migration-folder';
import { readMigrationFolder } from '../../check/migrations/read-migration-folder';
import { migrationsAt } from '../migrations-at';
import type { MigrationOrderFinding } from './migration-order-finding';
import type { TrunkToFollow } from './trunk-to-follow';

const TOOLS = { knex: 'knex', prisma: 'Prisma', typeorm: 'TypeORM' } as const;

/**
 * Under knex, Prisma and TypeORM a migration is a file (a folder under Prisma) the tool orders by
 * its name, and each of the three runs whatever the database has not run yet: one that sorts
 * before the last of the trunk runs after it where the trunk's is applied, and before it on a new
 * database.
 */
export function namedOrder(root: string, orm: keyof typeof TOOLS, trunk: TrunkToFollow): MigrationOrderFinding[] {
  const folder = readMigrationFolder(root, orm);
  const where = { folder: folder?.folder ?? 'migrations', directories: orm === 'prisma' };
  const onTrunk = migrationsAt(root, trunk.commit, where);
  const last = onTrunk.at(-1);

  if (last === undefined) {
    return [];
  }

  const landed = new Set(onTrunk.map((migration) => migration.name));

  return (folder?.migrations ?? [])
    .filter(({ name }) => !landed.has(name) && !isWorkingMigration(name) && name < last.name)
    .map((migration) => beforeTrunk(migration, { tool: TOOLS[orm], last: last.name, trunk }));
}

function beforeTrunk(
  { name, file }: Migration,
  { tool, last, trunk }: { tool: string; last: string; trunk: TrunkToFollow },
): MigrationOrderFinding {
  const brought = trunk.merged ? `${trunk.name} being merged already, it` : `it brings ${trunk.name} in and`;

  return {
    kind: 'before-trunk',
    migration: name,
    file,
    trunkLast: last,
    text: `the migration "${name}" of this branch sorts before "${last}", the last migration of ${trunk.name}: ${tool} runs it after "${last}" on a database that already applied that one, and before it on a new database, so one history runs in two orders`,
    fix: `Run \`npx ddd-ts-kit merge-trunk --to-land\` before the landing: ${brought} renames the migration with a number after "${last}", its content kept. When it changes a table a later migration of ${trunk.name} changes too, the command stops and says to generate it again.`,
  };
}
