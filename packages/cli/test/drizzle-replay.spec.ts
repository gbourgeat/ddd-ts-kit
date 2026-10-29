import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { drizzleHistoryFindings } from '../src/check/migrations/drizzle-history-findings';
import { readDrizzleMigrations } from '../src/check/migrations/read-drizzle-migrations';
import { cli, exists, read, tempDir, write } from './helpers';
import { DRIZZLE_KIT_STUB } from './support/drizzle-kit-stub';
import { git } from './support/git';

const JOURNAL = 'migrations/meta/_journal.json';

/** Generating again waits for the next second between two migrations, as drizzle-kit numbers them to the second. */
const REPLAY_TIMEOUT = 20_000;

/** A repository on `main` whose drizzle-kit is the stand-in, with a first migration committed. */
function repository(): string {
  const root = tempDir('drizzle-replay');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {} }));
  write(root, 'node_modules/drizzle-kit/bin.cjs', DRIZZLE_KIT_STUB);
  write(root, '.gitignore', 'node_modules\n.ddd-ts-kit\n');
  write(root, 'schema/accounts.json', JSON.stringify({ name: 'accounts' }));
  generate(root, 'initial');
  git(root, 'init', '--quiet', '--initial-branch', 'main');
  commit(root, 'chore: bootstrap');

  return root;
}

function generate(root: string, ...args: string[]): void {
  const result = cli(root, 'drizzle-generate', '--name', ...args);

  if (result.code !== 0) {
    throw new Error(`drizzle-generate failed (${result.code}): ${result.stderr}`);
  }
}

function commit(root: string, message: string): void {
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', message);
}

/** The worker of billing adds the invoices, the trunk adds the payments meanwhile, then the branch merges the trunk. */
function branchesThatBothAddedAMigration(root: string, branchWork: () => void = () => undefined): void {
  git(root, 'switch', '--quiet', '--create', 'build/billing');
  write(root, 'schema/invoices.json', JSON.stringify({ name: 'invoices' }));
  generate(root, 'working-add-invoices');
  branchWork();
  commit(root, 'feat(billing): issue an invoice');

  git(root, 'switch', '--quiet', 'main');
  write(root, 'schema/payments.json', JSON.stringify({ name: 'payments' }));
  generate(root, 'add-payments');
  commit(root, 'feat(payments): record a payment');

  git(root, 'switch', '--quiet', 'build/billing');
  expect(() => git(root, 'merge', '--quiet', '--no-edit', 'main')).toThrow();
}

function migrationNames(root: string): string[] {
  const journal = JSON.parse(read(root, JOURNAL)) as { entries: { tag: string }[] };

  return journal.entries.map((entry) => entry.tag.slice(entry.tag.indexOf('_') + 1));
}

function tagOf(root: string, name: string): string {
  const file = fs.readdirSync(path.join(root, 'migrations')).find((entry) => entry.endsWith(`_${name}.sql`));

  return file === undefined ? '' : file.slice(0, -'.sql'.length);
}

describe('ddd-ts-kit drizzle-generate --replay of a forked history', () => {
  it('refuses while the journal holds the conflict markers of the merge, and says how to take the one of the base', () => {
    const root = repository();

    branchesThatBothAddedAMigration(root);

    const result = cli(root, 'drizzle-generate', '--replay', '--base', 'main');

    expect(result.code).toBe(2);
    expect(read(root, JOURNAL)).toContain('<<<<<<<');
    expect(result.stderr).toContain(`${JOURNAL} still holds the conflict markers`);
    expect(result.stderr).toContain(`git checkout main -- ${JOURNAL}`);
  });

  it(
    'generates the working migration of a worker again on top of the trunk, under its name, after deleting it',
    () => {
      const root = repository();

      branchesThatBothAddedAMigration(root);
      write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing' }));
      git(root, 'checkout', 'main', '--', JOURNAL);

      const before = tagOf(root, 'working-add-invoices');
      const result = cli(root, 'drizzle-generate', '--replay', '--base', 'main');
      const after = tagOf(root, 'working-add-invoices');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain(`Deleted, with their snapshots and journal entries: ${before}.`);
      expect(result.stdout).toContain(`Generated ${after} in place of ${before}.`);
      expect(after > tagOf(root, 'add-payments')).toBe(true);
      expect(exists(root, `migrations/${before}.sql`)).toBe(false);
      expect(read(root, `migrations/${after}.sql`)).toBe('CREATE TABLE "invoices" ();');
      expect(migrationNames(root)).toEqual(['initial', 'add-payments', 'working-add-invoices']);
      expect(drizzleHistoryFindings(readDrizzleMigrations(root) ?? fail())).toEqual([]);
    },
    REPLAY_TIMEOUT,
  );

  it(
    'gives the conductor the real migration, and a custom migration its statements back, in their order',
    () => {
      const root = repository();

      branchesThatBothAddedAMigration(root, () => {
        generate(root, 'backfill-due-dates', '--custom');
        write(root, `migrations/${tagOf(root, 'backfill-due-dates')}.sql`, 'UPDATE "invoices" SET "due" = now();\n');
      });

      git(root, 'checkout', 'main', '--', JOURNAL);

      const result = cli(root, 'drizzle-generate', '--replay', '--base', 'main');

      expect(result.code).toBe(0);
      expect(migrationNames(root)).toEqual(['initial', 'add-payments', 'add-invoices', 'backfill-due-dates']);
      expect(read(root, `migrations/${tagOf(root, 'add-invoices')}.sql`)).toBe('CREATE TABLE "invoices" ();');
      expect(read(root, `migrations/${tagOf(root, 'backfill-due-dates')}.sql`)).toContain('SET "due" = now()');
      expect(tagOf(root, 'working-add-invoices')).toBe('');
      expect(drizzleHistoryFindings(readDrizzleMigrations(root) ?? fail())).toEqual([]);
      expect(result.stdout).toContain('Stage migrations/, then run `npm run check:arch`.');
    },
    REPLAY_TIMEOUT,
  );

  it(
    'refuses a generated migration whose SQL was edited by hand, and puts the migrations folder back as it found it',
    () => {
      const root = repository();

      branchesThatBothAddedAMigration(root, () => {
        const sql = `migrations/${tagOf(root, 'working-add-invoices')}.sql`;

        write(
          root,
          sql,
          `${read(root, sql)}\n--> statement-breakpoint\nCREATE INDEX "invoices_due" ON "invoices" ("due");`,
        );
      });

      git(root, 'checkout', 'main', '--', JOURNAL);

      const tag = tagOf(root, 'working-add-invoices');
      const before = git(root, 'status', '--porcelain');
      const result = cli(root, 'drizzle-generate', '--replay', '--base', 'main');

      expect(result.code).toBe(2);
      expect(result.stderr).toContain(`${tag} is not what drizzle-kit writes for its change on top of main`);
      expect(result.stderr).toContain('the branch has `CREATE INDEX "invoices_due" ON "invoices" ("due")`');
      expect(result.stderr).toContain(`git show HEAD:migrations/${tag}.sql`);
      expect(git(root, 'status', '--porcelain')).toBe(before);
      expect(fs.readdirSync(path.join(root, 'migrations')).filter((entry) => entry.endsWith('.sql'))).toHaveLength(3);
    },
    REPLAY_TIMEOUT,
  );
});

describe('ddd-ts-kit drizzle-generate --replay with nothing forked, or refused', () => {
  it('finds nothing forked once the migration of the branch follows the trunk, and only renames a working one', () => {
    const root = repository();

    git(root, 'switch', '--quiet', '--create', 'build/billing');
    write(root, 'schema/invoices.json', JSON.stringify({ name: 'invoices' }));
    generate(root, 'working-add-invoices');
    write(root, `migrations/${tagOf(root, 'working-add-invoices')}.sql`, 'CREATE TABLE "invoices" ("due" date);');
    commit(root, 'feat(billing): issue an invoice');

    const working = tagOf(root, 'working-add-invoices');

    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing' }));

    const kept = cli(root, 'drizzle-generate', '--replay', '--base', 'main');

    expect(kept.code).toBe(0);
    expect(kept.stdout).toContain('The migrations of this branch follow the last one of main: nothing to replay.');
    expect(git(root, 'status', '--porcelain')).toBe('');

    fs.rmSync(path.join(root, '.ddd-ts-kit'), { recursive: true });

    const renamed = cli(root, 'drizzle-generate', '--replay', '--base', 'main');
    const real = working.replace('_working-', '_');

    expect(renamed.code).toBe(0);
    expect(renamed.stdout).toContain(`Renamed ${working} to ${real}: it follows the last migration of main`);
    expect(read(root, `migrations/${real}.sql`)).toBe('CREATE TABLE "invoices" ("due" date);');
    expect(migrationNames(root)).toEqual(['initial', 'add-invoices']);
    expect(drizzleHistoryFindings(readDrizzleMigrations(root) ?? fail())).toEqual([]);
  });

  it('refuses two migrations of the branch that change the schema, before deleting anything', () => {
    const root = repository();

    branchesThatBothAddedAMigration(root, () => {
      write(root, 'schema/credit-notes.json', JSON.stringify({ name: 'credit_notes' }));
      generate(root, 'working-add-credit-notes');
    });

    git(root, 'checkout', 'main', '--', JOURNAL);

    const result = cli(root, 'drizzle-generate', '--replay', '--base', 'main');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('2 migrations of this branch change the schema');
    expect(tagOf(root, 'working-add-invoices')).not.toBe('');
    expect(tagOf(root, 'working-add-credit-notes')).not.toBe('');
  });

  it('refuses a base with migrations the branch has not merged, and a base that is not a commit', () => {
    const root = repository();

    git(root, 'switch', '--quiet', '--create', 'build/billing');
    git(root, 'switch', '--quiet', 'main');
    write(root, 'schema/payments.json', JSON.stringify({ name: 'payments' }));
    generate(root, 'add-payments');
    commit(root, 'feat(payments): record a payment');
    git(root, 'switch', '--quiet', 'build/billing');

    const behind = cli(root, 'drizzle-generate', '--replay', '--base', 'main');
    const unknown = cli(root, 'drizzle-generate', '--replay', '--base', 'origin/trunk');

    expect(behind.code).toBe(2);
    expect(behind.stderr).toContain('main has migrations this branch does not have');
    expect(behind.stderr).toContain('git merge main');
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('origin/trunk is not a commit of this repository');

    git(root, 'update-ref', 'refs/heads/-x', 'main');

    const dashed = cli(root, 'drizzle-generate', '--replay', '--base=-x');

    expect(dashed.code).toBe(2);
    expect(dashed.stderr).toContain('-x has migrations this branch does not have');
  });

  it('has nothing to replay where the branch added no migration', () => {
    const root = repository();

    const result = cli(root, 'drizzle-generate', '--replay', '--base', 'main');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('nothing to replay');
  });
});

function fail(): never {
  throw new Error('The journal was not read.');
}
