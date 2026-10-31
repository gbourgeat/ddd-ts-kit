import {
  answeredAsJson,
  ensureDatabaseReachable,
  generateGuarded,
  hasDatabaseUrl,
  offlinePrismaMigration,
  refuseOtherOrm,
  requiredMigrationName,
  runOrmTool,
} from '../migration';
import type { Command } from './command';
import type { Io } from './io';
import { parseMigrationArguments } from './parse-migration-arguments';

/**
 * `db:generate` of a Prisma project: `prisma migrate dev --create-only`, then, with an audit trail,
 * the statements that make it append-only at the end of the migration that creates it. With no
 * `DATABASE_URL`, no server is needed: the migration is diffed on PostgreSQL in process.
 */
export const prismaGenerateCommand: Command = (argv, io) => {
  const args = parseMigrationArguments(argv, { name: { type: 'string' } });
  const root = args.projectRoot;

  refuseOtherOrm(root, 'prisma');

  const name = requiredMigrationName(args.text('name'));

  ensureDatabaseReachable();

  const offline = !hasDatabaseUrl();

  const generate = (out: Io): number =>
    generateGuarded(
      {
        root,
        orm: 'prisma',
        folder: 'prisma/migrations',
        migration: /^migration\.sql$/,
        generate: () =>
          offline
            ? offlinePrismaMigration({ root, folder: 'prisma/migrations', name, io: out })
            : runOrmTool(root, 'prisma/build/index.js', ['migrate', 'dev', '--create-only', '--name', name]),
      },
      out,
    );

  return args.json ? answeredAsJson({ root, folders: ['prisma/migrations'] }, io, generate) : generate(io);
};
