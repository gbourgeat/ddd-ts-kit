import { drizzleHistoryFindings } from '../migrations/drizzle-history-findings.js';
import { migrationNameFindings } from '../migrations/migration-name-findings.js';
import { readDrizzleMigrations } from '../migrations/read-drizzle-migrations.js';
import { readMigrationFolder } from '../migrations/read-migration-folder.js';
import type { Rule } from '../model/rule.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

export const persistenceMigrationHistory: Rule = {
  id: 'persistence/migration-history',
  description:
    'Every migration is named `<timestamp>_<what-it-does>` and no two share a number; under drizzle-kit, the journal and the files match, the entries keep the order they were generated in and each snapshot follows the one before it.',
  scope: 'project',
  run(project) {
    const { orm } = project.config.stack;
    const report = reporter(project, this.id);
    const folder = readMigrationFolder(project.root, orm);
    const drizzle = orm === 'drizzle' ? readDrizzleMigrations(project.root) : undefined;

    return [
      ...(folder === undefined ? [] : migrationNameFindings(folder.migrations)).flatMap(([migration, finding]) =>
        toViolations(report, migration.file, [finding]),
      ),
      ...(drizzle === undefined
        ? []
        : toViolations(report, `${drizzle.folder}/meta/_journal.json`, drizzleHistoryFindings(drizzle))),
    ];
  },
};
