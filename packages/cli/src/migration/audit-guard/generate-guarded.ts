import { readConfig } from '../../config';
import type { Io } from '../../commands/io';
import { writtenPaths } from '../written-paths';
import { appendAuditGuard } from './append-audit-guard';
import { auditGuardStatementsOf } from './audit-guard-statements-of';
import type { GuardedOrm } from './guarded-text';
import { migrationsUnder } from './migrations-under';

export interface GuardedGeneration {
  readonly root: string;
  readonly orm: GuardedOrm;
  /** Where the tool writes its migrations, and what a migration is named. */
  readonly folder: string;
  readonly migration: RegExp;
  /** Runs the tool of the ORM and answers its exit code. */
  readonly generate: () => number;
  /** Brings what the tool wrote to the rules of the project, the guard added: its imports, its format. */
  readonly tidy?: (written: readonly string[]) => void;
}

/** The tool of the ORM writes a migration; with an audit trail, the one that creates it is made append-only; then it is tidied. */
export function generateGuarded(generation: GuardedGeneration, io: Io): number {
  const { root, orm, folder, migration } = generation;
  const before = migrationsUnder(root, folder, migration);
  const code = generation.generate();

  if (code !== 0) {
    return code;
  }

  const after = migrationsUnder(root, folder, migration);
  const written = writtenPaths(before, after);

  if (readConfig(root).config.stack.audit === 'on') {
    appendAuditGuard({ root, orm, written, migrations: [...after.keys()] }, auditGuardStatementsOf(root, orm), io);
  }

  generation.tidy?.(written);

  return code;
}
