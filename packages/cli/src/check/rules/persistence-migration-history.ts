import fs from 'node:fs';
import path from 'node:path';
import { WORKER_SCOPE_FILE } from '../../commit/worker-scope-file';
import { drizzleHistoryFindings } from '../migrations/drizzle-history-findings';
import { migrationNameFindings } from '../migrations/migration-name-findings';
import { readDrizzleMigrations } from '../migrations/read-drizzle-migrations';
import { readMigrationFolder } from '../migrations/read-migration-folder';
import { workingMigrationFindings } from '../migrations/working-migration-findings';
import type { Rule } from '../model/rule';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

export const persistenceMigrationHistory: Rule = {
  id: 'persistence/migration-history',
  description:
    'Every migration is named `<timestamp>_<what-it-does>` and no two share a number; a working migration stays in the worktree of its worker; under drizzle-kit, the journal and the files match, the entries keep the order they were generated in and each snapshot follows the one before it.',
  scope: 'project',
  run(project) {
    const { orm } = project.config.stack;
    const report = reporter(project, this.id);
    const folder = readMigrationFolder(project.root, orm);
    const drizzle = orm === 'drizzle' ? readDrizzleMigrations(project.root) : undefined;
    const migrations = folder?.migrations ?? [];
    // In the worktree of a worker, its working migration is what lets its specs run.
    const inWorker = fs.existsSync(path.join(project.root, WORKER_SCOPE_FILE));

    return [
      ...[...migrationNameFindings(migrations), ...(inWorker ? [] : workingMigrationFindings(migrations))].flatMap(
        ([migration, finding]) => toViolations(report, migration.file, [finding]),
      ),
      ...(drizzle === undefined
        ? []
        : toViolations(report, `${drizzle.folder}/meta/_journal.json`, drizzleHistoryFindings(drizzle))),
    ];
  },
};
