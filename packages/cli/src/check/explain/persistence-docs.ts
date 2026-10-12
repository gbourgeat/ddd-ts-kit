import type { RuleDoc } from '../model/rule-doc.js';

export const PERSISTENCE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'persistence/migration-history': {
    why: 'Migrations are applied in the order of their names, and several people add them at the same time. Numbered by an index, two branches each write `0002_...` and the order between them is a guess; named by a random word, nobody knows what a migration does. A timestamp and a description, `20261012093000_add-invoices`, keep every branch apart. drizzle-kit adds a journal and a chain of snapshots on top: its migrator applies only the entries newer than the last one a database applied, so an entry merged out of order is skipped without a word, and a snapshot generated from the same parent as another makes the next migration miss a change. After a merge, the migration of the branch is generated again on top of the main branch.',
    bad: `migrations/
  0002_brave_falcon.sql          # an index, a random name
  0002_quiet_owl.sql             # the same index, from another branch
  meta/_journal.json             # entries 0002 and 0002, two snapshots with one parent`,
    good: `migrations/
  20261010120000_add-invoices.sql
  20261012093000_add-payments.sql   # generated again after main took add-invoices
  meta/_journal.json                # one entry each, in order, each snapshot from the one before`,
  },
};
