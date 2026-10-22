import { drizzleOutFolder } from '../check/migrations/drizzle-out-folder';
import type { Io } from '../commands/io';
import type { DrizzleRun } from './drizzle-run';
import { type DrizzleMigration, generateDrizzleMigration } from './generate-drizzle-migration';
import { migrationFiles } from './migration-files';
import { writtenPaths } from './written-paths';

/** Runs drizzle-kit generate for one migration and reads the migrations folder before and after it: what it wrote. */
export function generateAndRead(migration: DrizzleMigration, io: Io): DrizzleRun {
  const { root } = migration;
  const folder = drizzleOutFolder(root);
  const before = migrationFiles(root, folder);
  const code = generateDrizzleMigration(migration, io);
  const after = migrationFiles(root, folder);

  return { code, written: { root, paths: writtenPaths(before, after), files: after } };
}
