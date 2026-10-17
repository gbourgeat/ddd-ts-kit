import { drizzleOutFolder } from '../check/migrations/drizzle-out-folder.js';
import type { Io } from '../commands/io.js';
import type { DrizzleRun } from './drizzle-run.js';
import { type DrizzleMigration, generateDrizzleMigration } from './generate-drizzle-migration.js';
import { migrationFiles } from './migration-files.js';
import { writtenPaths } from './written-paths.js';

/** Runs drizzle-kit generate for one migration and reads the migrations folder before and after it: what it wrote. */
export function generateAndRead(migration: DrizzleMigration, io: Io): DrizzleRun {
  const { root } = migration;
  const folder = drizzleOutFolder(root);
  const before = migrationFiles(root, folder);
  const code = generateDrizzleMigration(migration, io);
  const after = migrationFiles(root, folder);

  return { code, written: { root, paths: writtenPaths(before, after), files: after } };
}
