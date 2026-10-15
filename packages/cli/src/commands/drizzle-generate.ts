import { CliError } from '../cli-error.js';
import { generateDrizzleMigration } from '../migration/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/** `db:generate` of a Drizzle project: drizzle-kit generate, which fails instead of succeeding silently when it cannot ask its question. */
export const drizzleGenerateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { name: { type: 'string' }, custom: { type: 'boolean', default: false } });
  const name = args.text('name')?.trim() ?? '';

  if (name === '') {
    throw new CliError(
      'A migration is named by what it does.',
      'Run `npm run db:generate <what-it-does>`, for example `npm run db:generate add-invoices`.',
    );
  }

  const interactive = process.stdin.isTTY && process.stdout.isTTY;

  return generateDrizzleMigration({ root: args.projectRoot, name, custom: args.flag('custom'), interactive }, io);
};
