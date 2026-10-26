import type { Io } from '../commands/io';
import { formatAsTheProject } from './format-as-the-project';
import type { WrittenMigration } from './written-migration';

/**
 * Formats the snapshot and the journal drizzle-kit wrote under `meta/` as the project formats its
 * files, so that its format gate passes on them; the SQL is left as drizzle-kit wrote it. A
 * formatter that fails or is missing is reported: the migration is written either way.
 */
export function formatWrittenFiles({ root, paths }: WrittenMigration, io: Io): void {
  formatAsTheProject(
    root,
    paths.filter((file) => file.includes('/meta/') && file.endsWith('.json')),
    io,
  );
}
