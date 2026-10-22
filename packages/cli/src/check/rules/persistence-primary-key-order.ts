import path from 'node:path';
import { migrationFiles } from '../../migration/migration-files';
import { previousPrimaryKeys } from '../../migration/previous-primary-keys';
import { primaryKeyOrderFindings } from '../../migration/primary-key-order-findings';
import { drizzleOutFolder } from '../migrations/drizzle-out-folder';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

export const persistencePrimaryKeyOrder: Rule = {
  id: 'persistence/primary-key-order',
  description:
    'Under drizzle-kit, no migration adds the new primary key of a table before its old one is dropped, nor drops a column before the primary key that holds it: PostgreSQL refuses the migration when it runs.',
  scope: 'project',
  run(project) {
    if (project.config.stack.orm !== 'drizzle') {
      return [];
    }

    const report = reporter(project, this.id);
    const folder = drizzleOutFolder(project.root);
    const files = migrationFiles(project.root, folder);

    return [...files]
      .filter(([file]) => file.endsWith('.sql') && path.posix.dirname(file) === folder)
      .flatMap(([file, sql]) => toViolations(report, file, keyOrderFindings(files, file, sql)));
  },
};

function keyOrderFindings(files: ReadonlyMap<string, string>, file: string, sql: string): Finding[] {
  return primaryKeyOrderFindings(sql, previousPrimaryKeys(files, file)).map(({ early, message, fix }) => ({
    line: early.line,
    message,
    fix,
  }));
}
