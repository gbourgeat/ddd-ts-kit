import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { readConfig } from '../config';
import {
  ensureDatabaseReachable,
  formatAsTheProject,
  generateGuarded,
  hasDatabaseUrl,
  runOnInProcessDatabase,
  runOrmTool,
  schemasFirst,
  typeOnlyImports,
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
 * and the new one is the difference with the entities.
 */
export const typeormGenerateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const root = args.projectRoot;
  const [target] = args.positionals;

  if (target === undefined || target.trim() === '') {
    throw new CliError(
      'A migration is named by where it goes and what it does.',
      'Run `npm run db:generate migrations/<what-it-does>`, for example `npm run db:generate migrations/add-invoices`.',
    );
  }

  ensureDatabaseReachable();

  const offline = !hasDatabaseUrl();

  const dataSource = `dist/${readConfig(root).config.platformDir}/database/data-source.js`;

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
