import { CliError } from '../cli-error.js';
import { generateAndRead, replayDrizzleMigrations, tidyWrittenMigration } from '../migration/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/** The trunk a branch merged, when `--replay` is not given another. */
const DEFAULT_BASE = 'origin/main';

/**
 * `db:generate` of a Drizzle project: drizzle-kit generate, which fails instead of succeeding
 * silently when it cannot ask its question, then formats what it wrote and warns about a primary
 * key changed in an order that fails. `--replay` generates again the migrations of a branch on top
 * of the trunk it merged.
 */
export const drizzleGenerateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    name: { type: 'string' },
    custom: { type: 'boolean', default: false },
    replay: { type: 'boolean', default: false },
    base: { type: 'string' },
  });

  const root = args.projectRoot;
  const interactive = process.stdin.isTTY && process.stdout.isTTY;

  if (args.flag('replay')) {
    refuseNamedReplay(args);

    return replayDrizzleMigrations({ root, base: args.text('base') ?? DEFAULT_BASE, interactive }, io);
  }

  const name = namedMigration(args);
  const { code, written } = generateAndRead({ root, name, custom: args.flag('custom'), interactive }, io);

  if (code === 0) {
    tidyWrittenMigration(written, io);
  }

  return code;
};

function refuseNamedReplay(args: Arguments): void {
  if (args.text('name') !== undefined || args.flag('custom')) {
    throw new CliError(
      'A replay generates the migrations of the branch again under their own names, custom ones included.',
      'Run `npx ddd-ts-kit drizzle-generate --replay [--base <ref>]`, without --name or --custom.',
    );
  }
}

function namedMigration(args: Arguments): string {
  const name = args.text('name')?.trim() ?? '';

  if (args.text('base') !== undefined) {
    throw new CliError(
      '--base names the trunk of a replay.',
      'Run `npx ddd-ts-kit drizzle-generate --replay --base <ref>` after merging the trunk into the branch.',
    );
  }

  if (name === '') {
    throw new CliError(
      'A migration is named by what it does.',
      'Run `npm run db:generate <what-it-does>`, for example `npm run db:generate add-invoices`.',
    );
  }

  return name;
}
