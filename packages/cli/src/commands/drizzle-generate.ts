import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CliError } from '../cli-error';
import { readConfig } from '../config';
import { withGeneratorLock } from '../generator-lock';
import {
  appendAuditGuard,
  auditGuardStatementsOf,
  generateAndRead,
  migrationName,
  replayDrizzleMigrations,
  schemasIfMissing,
  tidyWrittenMigration,
} from '../migration';
import type { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';
import { parseMigrationArguments } from './parse-migration-arguments';

/** The trunk a branch merged, when `--replay` is not given another. */
const DEFAULT_BASE = 'origin/main';

/**
 * `db:generate` of a Drizzle project: drizzle-kit generate, which fails instead of succeeding
 * silently when it cannot ask its question, then formats what it wrote and warns about a primary
 * key changed in an order that fails. `--replay` generates again the migrations of a branch on top
 * of the trunk it merged.
 */
export const drizzleGenerateCommand: Command = (argv, io) => {
  const args = parseMigrationArguments(argv, {
    name: { type: 'string' },
    custom: { type: 'boolean', default: false },
    replay: { type: 'boolean', default: false },
    base: { type: 'string' },
  });

  // drizzle-kit numbers the migration and writes the journal from what it finds: one generator at a time does.
  return withGeneratorLock({ root: args.projectRoot, command: `ddd-ts-kit drizzle-generate ${argv.join(' ')}` }, () =>
    generateMigration(args, io),
  );
};

function generateMigration(args: Arguments, io: Io): number {
  const root = args.projectRoot;
  const interactive = process.stdin.isTTY && process.stdout.isTTY;

  if (args.flag('replay')) {
    refuseNamedReplay(args);

    return replayDrizzleMigrations({ root, base: args.text('base') ?? DEFAULT_BASE, interactive }, io);
  }

  const name = namedMigration(args);
  const { code, written } = generateAndRead({ root, name, custom: args.flag('custom'), interactive }, io);

  if (code === 0) {
    createSchemasIfMissing(root, written.paths);
    tidyWrittenMigration(written, io);
    guardTheAuditTrail({ root, written: written.paths, files: [...written.files.keys()] }, io);
  }

  return code;
}

/** drizzle-kit writes `CREATE SCHEMA` alone: a schema that exists already is left as it is. */
function createSchemasIfMissing(root: string, written: readonly string[]): void {
  for (const file of written.filter((path) => path.endsWith('.sql'))) {
    const full = join(root, file);

    writeFileSync(full, schemasIfMissing(readFileSync(full, 'utf8')));
  }
}

/** With an audit trail, the migration that creates it makes it append-only, which drizzle-kit cannot write. */
function guardTheAuditTrail(
  { root, written, files }: { root: string; written: readonly string[]; files: readonly string[] },
  io: Io,
): void {
  if (readConfig(root).config.stack.audit !== 'on') {
    return;
  }

  const sql = (file: string): boolean => file.endsWith('.sql');

  appendAuditGuard(
    { root, orm: 'drizzle', written: written.filter(sql), migrations: files.filter(sql) },
    auditGuardStatementsOf(root, 'drizzle'),
    io,
  );
}

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

  return migrationName(name, 'Name it by what it does, in kebab-case: `npm run db:generate add-invoices`.');
}
