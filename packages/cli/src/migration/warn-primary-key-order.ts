import type { Io } from '../commands/io';
import { previousPrimaryKeys } from './previous-primary-keys';
import { primaryKeyOrderFindings } from './primary-key-order-findings';
import type { WrittenMigration } from './written-migration';

/** Warns, without changing the exit code, about each SQL file just written that changes a primary key in an order that fails. */
export function warnPrimaryKeyOrder({ paths, files }: WrittenMigration, io: Io): void {
  for (const file of paths.filter((written) => written.endsWith('.sql'))) {
    for (const finding of primaryKeyOrderFindings(files.get(file) ?? '', previousPrimaryKeys(files, file))) {
      io.err(
        [
          `Warning: ${file}: ${finding.message}`,
          `  line ${finding.early.line}: ${finding.early.text}`,
          `  line ${finding.drop.line}: ${finding.drop.text}`,
          `  Fix: ${finding.fix}`,
        ].join('\n'),
      );
    }
  }
}
