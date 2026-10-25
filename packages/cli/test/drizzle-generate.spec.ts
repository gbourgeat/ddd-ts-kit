import { describe, expect, it } from 'vitest';
import { generateDrizzleMigration } from '../src/migration';
import { cli, exists, read, tempDir, write } from './helpers';
import { DRIZZLE_KIT_STUB } from './support/drizzle-kit-stub';

const BIN = 'node_modules/drizzle-kit/bin.cjs';

/** A project whose drizzle-kit is a stand-in: it records its arguments, then behaves as `script` says. */
function projectWithDrizzleKit(script: string): string {
  const root = tempDir('drizzle-generate');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {} }));

  write(
    root,
    BIN,
    `require('node:fs').writeFileSync('arguments.json', JSON.stringify(process.argv.slice(2)));\n${script}\n`,
  );

  return root;
}

const PROMPT_REFUSED =
  "console.log('Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false).'); process.exit(0);";

describe('ddd-ts-kit drizzle-generate', () => {
  it('makes the audit trail append-only in the migration that creates it, with the statements of the installed package', () => {
    const root = projectWithDrizzleKit(
      "const fs = require('node:fs'); fs.mkdirSync('migrations', { recursive: true }); fs.writeFileSync('migrations/0000_init.sql', 'CREATE TABLE \"audit\".\"audit_entries\" (\"id\" text);\\n');",
    );

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {}, stack: { audit: 'on' } }));

    write(
      root,
      'node_modules/@ddd-ts-kit/audit/package.json',
      JSON.stringify({ type: 'module', exports: { './drizzle': './drizzle.js' } }),
    );

    write(
      root,
      'node_modules/@ddd-ts-kit/audit/drizzle.js',
      'export const auditGuardStatements = (schema) => [`create function "${schema}"."audit_entries_append_only"()`];\n',
    );

    const result = cli(root, 'drizzle-generate', '--name', 'init');

    expect(result.stdout).toContain('audit guard   migrations/0000_init.sql');

    expect(read(root, 'migrations/0000_init.sql')).toBe(
      'CREATE TABLE "audit"."audit_entries" ("id" text);\n--> statement-breakpoint\ncreate function "audit"."audit_entries_append_only"();\n',
    );
  });

  it('runs drizzle-kit generate with the name of the migration, in the project root, and prints what it printed', () => {
    const root = projectWithDrizzleKit("console.log('Your SQL migration file is migrations/1_add-invoices.sql');");

    const result = cli(root, 'drizzle-generate', '--name', 'add-invoices');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('migrations/1_add-invoices.sql');
    expect(JSON.parse(read(root, 'arguments.json'))).toEqual(['generate', '--name', 'add-invoices']);
  });

  it('passes --custom on, for the statements drizzle-kit does not write', () => {
    const root = projectWithDrizzleKit('');

    cli(root, 'drizzle-generate', '--name', 'audit-guard', '--custom');

    expect(JSON.parse(read(root, 'arguments.json'))).toEqual(['generate', '--name', 'audit-guard', '--custom']);
  });

  it('fails, with the fix, where drizzle-kit would ask about a rename without a terminal and exit 0', () => {
    const root = projectWithDrizzleKit(PROMPT_REFUSED);

    const result = cli(root, 'drizzle-generate', '--name', 'rename-label');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('no migration was written');
    expect(result.stderr).toContain('--custom');
  });

  it('fails, with the fix, where drizzle-kit finds two snapshots of one parent and exits 0', () => {
    const root = projectWithDrizzleKit(
      "console.log('[a, b] are pointing to a parent snapshot: c/snapshot.json which is a collision.');",
    );

    const result = cli(root, 'drizzle-generate', '--name', 'add-payments');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('persistence/migration-history');
  });

  it('answers the exit code of drizzle-kit when it fails on its own', () => {
    const root = projectWithDrizzleKit("console.error('Error: no schema'); process.exit(3);");

    const result = cli(root, 'drizzle-generate', '--name', 'add-invoices');

    expect(result.code).toBe(3);
    expect(result.stderr).toContain('no schema');
  });

  it('refuses a migration without a name, before running drizzle-kit', () => {
    const root = projectWithDrizzleKit('');

    const result = cli(root, 'drizzle-generate');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('npm run db:generate <what-it-does>');
    expect(exists(root, 'arguments.json')).toBe(false);
  });

  it('refuses a name of blanks', () => {
    const root = projectWithDrizzleKit('');

    expect(cli(root, 'drizzle-generate', '--name', '  ').code).toBe(2);
  });

  it('leaves drizzle-kit as is in a terminal, where a person answers its questions', () => {
    const root = projectWithDrizzleKit('process.exit(4);');
    const printed: string[] = [];
    const io = { out: (text: string) => printed.push(text), err: (text: string) => printed.push(text) };

    const code = generateDrizzleMigration({ root, name: 'rename-label', custom: false, interactive: true }, io);

    expect(code).toBe(4);
    expect(printed).toEqual([]);
    expect(JSON.parse(read(root, 'arguments.json'))).toEqual(['generate', '--name', 'rename-label']);
  });

  it('answers 1 when drizzle-kit is stopped by a signal', () => {
    const root = projectWithDrizzleKit("process.kill(process.pid, 'SIGTERM');");
    const io = { out: () => undefined, err: () => undefined };

    expect(generateDrizzleMigration({ root, name: 'add-invoices', custom: false, interactive: false }, io)).toBe(1);
  });

  it('says to install the dependencies when drizzle-kit is missing', () => {
    const root = tempDir('drizzle-generate');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {} }));

    const result = cli(root, 'drizzle-generate', '--name', 'add-invoices');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('npm install');
  });

  it('keeps --base and --name apart from --replay', () => {
    const root = projectWithDrizzleKit('');

    expect(cli(root, 'drizzle-generate', '--name', 'add-invoices', '--base', 'origin/main').stderr).toContain(
      '--base names the trunk of a replay',
    );

    expect(cli(root, 'drizzle-generate', '--replay', '--custom').stderr).toContain('without --name or --custom');
    expect(exists(root, 'arguments.json')).toBe(false);
  });
});

/** A project whose drizzle-kit is the stand-in that writes a migration from the tables of `schema/`. */
function projectWritingMigrations(): string {
  const root = tempDir('drizzle-generate');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {} }));
  write(root, BIN, DRIZZLE_KIT_STUB);

  return root;
}

/** Biome installed in the project, as a stand-in that records the paths it is given, then exits with `code`. */
function withBiome(root: string, code = 0): void {
  write(root, 'package.json', JSON.stringify({ scripts: { format: 'biome format --write .' } }));
  write(root, 'node_modules/@biomejs/biome/package.json', JSON.stringify({ bin: { biome: 'bin/biome' } }));

  write(
    root,
    'node_modules/@biomejs/biome/bin/biome',
    `require('node:fs').writeFileSync('formatted.json', JSON.stringify(process.argv.slice(2)));\nconsole.error('biome said no');\nprocess.exit(${code});\n`,
  );
}

const TABLE = JSON.stringify({ name: 'invoices', columns: { id: { name: 'id', primaryKey: true } } });

describe('ddd-ts-kit drizzle-generate, once drizzle-kit has written the migration', () => {
  it('formats the snapshot and the journal with the formatter of the format script, never the SQL', () => {
    const root = projectWritingMigrations();

    withBiome(root);
    write(root, 'schema/invoices.json', TABLE);

    const result = cli(root, 'drizzle-generate', '--name', 'add-invoices');
    const [command, inPlace, unmatched, ...paths] = JSON.parse(read(root, 'formatted.json')) as string[];

    expect(result.code).toBe(0);
    expect([command, inPlace, unmatched]).toEqual(['format', '--write', '--no-errors-on-unmatched']);
    expect(paths).toHaveLength(2);
    expect(paths).toContain('migrations/meta/_journal.json');
    expect(paths.every((file) => file.startsWith('migrations/meta/') && file.endsWith('.json'))).toBe(true);
    expect(result.stdout).toContain('Formatted with Biome, as the format script does: migrations/meta/');
  });

  it('reports a formatter that fails, and keeps the exit code of drizzle-kit', () => {
    const root = projectWritingMigrations();

    withBiome(root, 1);
    write(root, 'schema/invoices.json', TABLE);

    const result = cli(root, 'drizzle-generate', '--name', 'add-invoices');

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('Warning: Biome failed on migrations/meta/');
    expect(result.stderr).toContain('biome said no');
  });

  it('says what it leaves unformatted without a format script, or with a formatter not installed', () => {
    const root = projectWritingMigrations();

    write(root, 'schema/invoices.json', TABLE);

    expect(cli(root, 'drizzle-generate', '--name', 'add-invoices').stdout).toContain(
      'Not formatted (package.json has no `format` script that runs Biome or Prettier): migrations/meta/',
    );

    write(root, 'package.json', JSON.stringify({ scripts: { format: 'prettier --write .' } }));
    write(root, 'schema/payments.json', JSON.stringify({ name: 'payments' }));

    expect(cli(root, 'drizzle-generate', '--name', 'add-payments').stdout).toContain(
      'the format script runs Prettier, which is not installed',
    );
  });

  it('warns, exit code unchanged, when the migration drops a column before the primary key that holds it', () => {
    const root = projectWritingMigrations();

    write(root, 'schema/invoices.json', TABLE);
    cli(root, 'drizzle-generate', '--name', 'add-invoices');

    write(root, 'schema/invoices.json', JSON.stringify({ name: 'invoices', columns: { number: { name: 'number' } } }));

    write(
      root,
      'schema/invoices.sql',
      'ALTER TABLE "invoices" DROP COLUMN "id";--> statement-breakpoint\nALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey";',
    );

    const result = cli(root, 'drizzle-generate', '--name', 'number-invoices');

    expect(result.code).toBe(0);
    expect(result.stderr).toMatch(/Warning: migrations\/\d+_number-invoices\.sql: The column "id" of "invoices"/);
    expect(result.stderr).toContain('  line 1: ALTER TABLE "invoices" DROP COLUMN "id"');
    expect(result.stderr).toContain('  line 2: ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey"');
    expect(result.stderr).toContain('Fix: Drop the key first');
  });
});
