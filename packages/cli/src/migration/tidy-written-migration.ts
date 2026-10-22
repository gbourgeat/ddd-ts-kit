import type { Io } from '../commands/io';
import { formatWrittenFiles } from './format-written-files';
import { warnPrimaryKeyOrder } from './warn-primary-key-order';
import type { WrittenMigration } from './written-migration';

/** What follows a migration drizzle-kit wrote: its snapshot and journal formatted as the project formats its files, then the warnings on its SQL. */
export function tidyWrittenMigration(written: WrittenMigration, io: Io): void {
  formatWrittenFiles(written, io);
  warnPrimaryKeyOrder(written, io);
}
