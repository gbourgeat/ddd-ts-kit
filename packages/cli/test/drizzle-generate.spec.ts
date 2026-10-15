import { describe, expect, it } from 'vitest';
import { generateDrizzleMigration } from '../src/migration/index.js';
import { cli, exists, read, tempDir, write } from './helpers.js';

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
});
