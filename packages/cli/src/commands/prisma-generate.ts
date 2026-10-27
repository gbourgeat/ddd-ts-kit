import { CliError } from '../cli-error';
import { ensureDatabaseReachable, generateGuarded, runOrmTool } from '../migration';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * `db:generate` of a Prisma project: `prisma migrate dev --create-only`, then, with an audit trail,
 * the statements that make it append-only at the end of the migration that creates it.
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

  return generateGuarded(
    {
      root,
      orm: 'prisma',
      folder: 'prisma/migrations',
      migration: /^migration\.sql$/,
      generate: () => runOrmTool(root, 'prisma/build/index.js', ['migrate', 'dev', '--create-only', '--name', name]),
    },
    io,
  );
};
