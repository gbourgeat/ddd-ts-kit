import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { readConfig } from '../config';
import {
  ensureDatabaseReachable,
  formatAsTheProject,
  generateGuarded,
  hasDatabaseUrl,
  migrationName,
  runOnInProcessDatabase,
  runOrmTool,
  schemasFirst,
  typeOnlyImports,
  warnDroppedContextTables,
} from '../migration';
import { Arguments } from './arguments';
import type { Command } from './command';

const TYPEORM = 'typeorm/cli.js';

/** The data source of the platform reads the address; the in-process database is one session, so one connection. */
const IN_PROCESS_ENV = { DATABASE_URL: '{url}', DATABASE_POOL_SIZE: '1' };

/**
 * `db:generate` of a TypeORM project: `typeorm migration:generate` on the compiled data source of
 * the platform, then, with an audit trail, the statements that make it append-only at the end of
 * the `up` of the migration that creates it; the schemas of its tables are created first, which
 * TypeORM does not write, and the migration is brought to the rules of the project (type-only
 * imports, its formatter), since the build compiles it into `dist/migrations`. With no
 * `DATABASE_URL`, no server is needed: the migrations already written run on PostgreSQL in process,
 * and the new one is the difference with the entities. It says first when that difference will
 * drop the tables of a context the schema index no longer lists.
 */
export const typeormGenerateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const root = args.projectRoot;
  const target = migrationTarget(args.positionals[0]);

  ensureDatabaseReachable();

  const offline = !hasDatabaseUrl();

  const dataSource = `dist/${readConfig(root).config.platformDir}/database/data-source.js`;

  warnDroppedContextTables(root, io, 'typeorm');

  return generateGuarded(
    {
      root,
      orm: 'typeorm',
      folder: path.posix.dirname(target),
      migration: /\.ts$/,
      generate: () => generateMigration({ root, dataSource, target, offline }),
      tidy: (written) => {
        for (const file of written) {
          const full = path.join(root, file);

          fs.writeFileSync(full, schemasFirst(typeOnlyImports(fs.readFileSync(full, 'utf8'))));
        }

        formatAsTheProject(root, written, io);
      },
    },
    io,
  );
};

const TARGET_FIX =
  'Run `npm run db:generate migrations/<what-it-does>`, for example `npm run db:generate migrations/add-invoices`.';

/**
 * The path of the new migration, as `typeorm migration:generate` takes it: a folder of the project
 * and a name of letters, digits, dashes and underscores. A path that starts with a dash would be
 * read as an option of TypeORM, one that leaves the project would write there.
 */
function migrationTarget(target: string | undefined): string {
  if (target === undefined || target.trim() === '') {
    throw new CliError('A migration is named by where it goes and what it does.', TARGET_FIX);
  }

  if (target.includes('\\')) {
    throw new CliError(
      `"${target}" cannot be the path of a migration: it is written with a backslash, and the kit reads paths with \`/\` only (on Windows, through WSL 2).`,
      TARGET_FIX,
    );
  }

  const folder = path.posix.dirname(path.posix.normalize(target));

  if (path.posix.isAbsolute(folder) || folder === '..' || folder.startsWith('../') || folder.startsWith('-')) {
    throw new CliError(
      `"${target}" cannot be the path of a migration: its folder is not one of the project.`,
      TARGET_FIX,
    );
  }

  migrationName(path.posix.basename(target), TARGET_FIX);

  return target;
}

interface MigrationRun {
  readonly root: string;
  readonly dataSource: string;
  readonly target: string;
  /** No `DATABASE_URL`: the migrations run on the in-process database first. */
  readonly offline: boolean;
}

function generateMigration({ root, dataSource, target, offline }: MigrationRun): number {
  const generate = { bin: TYPEORM, args: ['migration:generate', '-d', dataSource, target], env: IN_PROCESS_ENV };

  return offline
    ? runOnInProcessDatabase(root, [{ ...generate, args: ['migration:run', '-d', dataSource] }, generate])
    : runOrmTool(root, TYPEORM, generate.args);
}
