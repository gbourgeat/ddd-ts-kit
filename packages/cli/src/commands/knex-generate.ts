import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { readConfig } from '../config';
import {
  formatAsTheProject,
  knexMigrationText,
  knexSchemaDifference,
  migrationsUnder,
  requiredMigrationName,
  runOrmTool,
  writtenPaths,
} from '../migration';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';

const KNEX = 'knex/bin/cli.js';
const FOLDER = 'migrations';
const MIGRATION = /\.js$/;

/**
 * `db:generate` of a Knex project. Knex has no schema diff: the kit compares the compiled
 * `createTables` with the migrations replayed, both on PostgreSQL in process, and writes the
 * difference as SQL held in the migration, which therefore stays true whatever `createTables`
 * becomes and replays on a fresh database. `--custom` writes the empty migration of knex, to fill
 * by hand: a change of data, or what the comparison reports and cannot write.
 */
export const knexGenerateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { name: { type: 'string' }, custom: { type: 'boolean', default: false } });
  const root = args.projectRoot;
  const name = requiredMigrationName(args.text('name'));

  refuseLiveMigrations(root);

  if (args.flag('custom')) {
    return writeMigration({ root, name, fill: () => undefined }, io);
  }

  const difference = knexSchemaDifference(root, compiledSchema(root));

  if (typeof difference === 'number') {
    return difference;
  }

  if (difference.statements.length === 0 && difference.unwritten.length === 0) {
    io.out('No schema change: `createTables` builds what the migrations build.');

    return 0;
  }

  for (const line of difference.unwritten) {
    io.err(`Not written, to write by hand in the migration: ${line}.`);
  }

  return writeMigration({ root, name, fill: () => knexMigrationText(difference) }, io);
};

interface MigrationToWrite {
  readonly root: string;
  readonly name: string;
  /** The content of the migration; undefined keeps the file of knex. */
  readonly fill: () => string | undefined;
}

/** `knex migrate:make` names the file, as it does for a migration written by hand; its content is then replaced. */
function writeMigration({ root, name, fill }: MigrationToWrite, io: Io): number {
  const before = migrationsUnder(root, FOLDER, MIGRATION);
  const code = runOrmTool(root, KNEX, ['migrate:make', name]);

  if (code !== 0) {
    return code;
  }

  const written = writtenPaths(before, migrationsUnder(root, FOLDER, MIGRATION));
  const content = fill();

  for (const file of written) {
    if (content !== undefined) {
      fs.writeFileSync(path.join(root, file), content);
    }
  }

  formatAsTheProject(root, written, io);

  return 0;
}

/**
 * A migration that calls `createTables` builds what the code holds today: replayed, it answers that
 * nothing differs, and the tables added since reach no database that has already run it.
 */
function refuseLiveMigrations(root: string): void {
  const live = [...migrationsUnder(root, FOLDER, MIGRATION)].find(([, content]) => content.includes('createTables('));

  if (live !== undefined) {
    throw new CliError(
      `${live[0]} calls \`createTables\`: what it builds changes with the code, so the migrations cannot be compared with it.`,
      'Replace its `up` by the SQL of the tables it created, keeping the file: knex never runs a recorded migration again, and refuses a missing one. The changelog says how, under the entry of `knex-generate`.',
    );
  }
}

/** Where the build leaves `createTables`, which plain node runs. */
function compiledSchema(root: string): string {
  const schema = `dist/${readConfig(root).config.platformDir}/database/schema.js`;

  if (!fs.existsSync(path.join(root, schema))) {
    throw new CliError(`${schema} is not built.`, 'Run `npm run db:generate <what-it-does>`, which builds first.');
  }

  return schema;
}
