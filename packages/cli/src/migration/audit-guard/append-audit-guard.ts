import fs from 'node:fs';
import path from 'node:path';
import type { Io } from '../../commands/io';
import { writeInsideProject } from '../../workspace/write-inside-project';
import { auditSchemaCreated } from './audit-schema-created';
import { GUARD_MARKER } from './guard-marker';
import { guardedText, type GuardedOrm } from './guarded-text';

export interface MigrationsWritten {
  readonly root: string;
  readonly orm: GuardedOrm;
  /** What the tool of the ORM just wrote, relative to the root. */
  readonly written: readonly string[];
  /** Every migration of the project once written, relative to the root. */
  readonly migrations: readonly string[];
}

/**
 * Makes the audit trail append-only in the migration that creates it: the tools of Drizzle, Prisma
 * and TypeORM write no trigger, so the statements of the guard follow the creation of the tables,
 * once. A project whose migrations already hold them, or none of whose migrations creates an audit
 * table, is left as it is; the check is made on every run, so that a run stopped before it was
 * made is completed by the next one, even when the tool of the ORM has nothing to write.
 */
export function appendAuditGuard(
  migrations: MigrationsWritten,
  statementsOf: (schema: string) => readonly string[],
  io: Io,
): void {
  const { root, orm, written } = migrations;
  const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

  if (migrations.migrations.some((file) => read(file).includes(GUARD_MARKER))) {
    return;
  }

  for (const file of [...written, ...migrations.migrations.filter((earlier) => !written.includes(earlier))]) {
    const schema = auditSchemaCreated(read(file));

    if (schema !== undefined) {
      writeInsideProject(root, file, guardedText(orm, read(file), statementsOf(schema)));
      io.out(`audit guard   ${file}: the entries and archives of the audit trail refuse UPDATE, DELETE and TRUNCATE`);

      return;
    }
  }
}
