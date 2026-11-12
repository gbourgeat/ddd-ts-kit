import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { DRIZZLE_KIT_STUB } from './support/drizzle-kit-stub';
import { git } from './support/git';
import { mergeWith } from './support/merge-repository';
import { commitFiles, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history';

const JOURNAL = 'migrations/meta/_journal.json';
const REPLAY_TIMEOUT = 30_000;

/** A drizzle project whose branch added a working migration, merged the trunk with git and kept the journal of the trunk. */
function drizzleMergedByGit(): string {
  const root = trunkRepository({
    'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
    'schema/accounts.json': '{"name":"accounts"}',
  });

  const generate = (name: string): number => cli(root, 'drizzle-generate', '--name', name).code;

  write(root, 'node_modules/drizzle-kit/bin.cjs', DRIZZLE_KIT_STUB);
  generate('initial');
  commitFiles(root, {}, 'chore: initial migration');
  onBranch(root, 'build/billing');
  write(root, 'schema/invoices.json', '{"name":"invoices"}');
  generate('working-add-invoices');
  commitFiles(root, {}, 'feat(billing): issue an invoice');
  onBranch(root, 'main');
  write(root, 'schema/payments.json', '{"name":"payments"}');
  generate('add-payments');
  commitFiles(root, {}, 'feat(payments): record a payment (#2)');

  const theirs = read(root, JOURNAL);

  onBranch(root, 'build/billing');
  mergeWith(root, { [JOURNAL]: theirs });

  return root;
}

function journalTags(root: string): string[] {
  return JSON.parse(read(root, JOURNAL)).entries.map((entry: { tag: string }) => entry.tag.replace(/^\d+_/, ''));
}

describe('merge-trunk --to-land on a drizzle branch that already holds the trunk', () => {
  it(
    'replays the migration a git merge left out of the journal of the trunk, under its real name',
    () => {
      const root = drizzleMergedByGit();
      const result = mergeTrunk(root, '--to-land');

      expect(result.code, result.stdout).toBe(0);
      expect(journalTags(root)).toEqual(['initial', 'add-payments', 'add-invoices']);

      expect(result.stdout).toContain(
        'reset it, or add to `drizzle.__drizzle_migrations` a row whose `created_at` is the `when` of its new entry in the journal',
      );

      expect(cli(root, 'verify-merge', '--since', 'main', '--json').json()).toMatchObject({ migrations: [] });
    },
    REPLAY_TIMEOUT,
  );

  it(
    'puts the folder back when the replay stops after it deleted the migration: the tree is clean and the same command runs again',
    () => {
      const root = drizzleMergedByGit();

      write(
        root,
        'node_modules/drizzle-kit/bin.cjs',
        "console.error('the schema does not compile');\nprocess.exit(1);\n",
      );

      const stopped = mergeTrunk(root, '--to-land');

      write(root, 'node_modules/drizzle-kit/bin.cjs', DRIZZLE_KIT_STUB);

      const cleanAfterTheStop = git(root, 'status', '--porcelain');
      const again = mergeTrunk(root, '--to-land');

      expect(stopped.code).toBe(1);
      expect(stopped.stdout).toContain('Deleted, with their snapshots and journal entries');

      expect(stopped.stdout).toContain(
        'stopped: the drizzle replay failed: read its output above. migrations/ is back as it was found: nothing is left to undo.',
      );

      expect(stopped.stdout).toContain('next: no merge is in progress, and the migrations are as they were found.');
      expect(cleanAfterTheStop).toBe('');
      expect(again.code, again.stdout).toBe(0);
      expect(journalTags(root)).toEqual(['initial', 'add-payments', 'add-invoices']);
    },
    REPLAY_TIMEOUT,
  );

  it(
    'says in a dry run which migration it would generate again, and touches nothing',
    () => {
      const root = drizzleMergedByGit();
      const previewed = mergeTrunk(root, '--to-land', '--dry-run');

      expect(previewed.stdout).toMatch(
        /\d+_working-add-invoices would be generated again after the migrations of the trunk/,
      );

      expect(previewed.stdout).toContain('next: run the same command without --dry-run to land these migrations');
      expect(git(root, 'status', '--porcelain')).toBe('');
    },
    REPLAY_TIMEOUT,
  );
});
