import { CliError } from '../cli-error';
import {
  ensureDatabaseReachable,
  generateGuarded,
  hasDatabaseUrl,
  offlinePrismaMigration,
  runOrmTool,
} from '../migration';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * `db:generate` of a Prisma project: `prisma migrate dev --create-only`, then, with an audit trail,
 * the statements that make it append-only at the end of the migration that creates it. With no
 * `DATABASE_URL`, no server is needed: the migration is diffed on PostgreSQL in process.
 */
export const prismaGenerateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { name: { type: 'string' } });
  const root = args.projectRoot;
  const name = args.text('name')?.trim() ?? '';

  if (name === '') {
    throw new CliError(
      'A migration is named by what it does.',
      'Run `npm run db:generate <what-it-does>`, for example `npm run db:generate add-invoices`.',
    );
  }

  ensureDatabaseReachable();

  const offline = !hasDatabaseUrl();

  return generateGuarded(
    {
      root,
      orm: 'prisma',
      folder: 'prisma/migrations',
      migration: /^migration\.sql$/,
      generate: () =>
        offline
          ? offlinePrismaMigration({ root, folder: 'prisma/migrations', name, io })
          : runOrmTool(root, 'prisma/build/index.js', ['migrate', 'dev', '--create-only', '--name', name]),
    },
    io,
  );
};
