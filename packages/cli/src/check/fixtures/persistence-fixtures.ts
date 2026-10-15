import { WORKER_SCOPE_FILE } from '../../commit/worker-scope-file.js';
import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { project } from './project.js';

const JOURNAL = 'migrations/meta/_journal.json';
const INITIAL = '20261010120000_initial';
const INVOICES = '20261011120000_add-invoices';
const PAYMENTS = '20261012120000_add-payments';
const ORIGIN = '00000000-0000-0000-0000-000000000000';

export const PERSISTENCE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'persistence/migration-history',
    name: 'drizzle migrations in the order generated, each snapshot from the one before',
    expect: 'pass',
    files: drizzle('b'),
  },
  {
    ruleId: 'persistence/migration-history',
    name: 'two drizzle migrations generated from the same snapshot on two branches',
    expect: { file: JOURNAL },
    files: drizzle('a'),
  },
  {
    ruleId: 'persistence/migration-history',
    name: 'a drizzle journal whose last entry was generated before the one it follows',
    expect: { file: JOURNAL },
    files: drizzle('b', [INITIAL, PAYMENTS, INVOICES]),
  },
  {
    ruleId: 'persistence/migration-history',
    name: 'knex migrations named by a timestamp, the index of the initial one kept',
    expect: 'pass',
    files: knex(['0001_initial', '20261012093000_add-invoices']),
  },
  {
    ruleId: 'persistence/migration-history',
    name: 'a knex migration written by hand without a number',
    expect: { file: 'migrations/add-invoices.js' },
    files: knex(['20261012093000_initial', 'add-invoices']),
  },
  {
    ruleId: 'persistence/migration-history',
    name: 'two knex migrations numbered by the same index on two branches',
    expect: { file: 'migrations/0002_add-payments.js' },
    files: knex(['0001_initial', '0002_add-invoices', '0002_add-payments']),
  },
  {
    ruleId: 'persistence/migration-history',
    name: 'a working migration in the worktree of the worker that generated it',
    expect: 'pass',
    files: {
      ...knex(['20261012093000_initial', '20261015101500_working-add-claims']),
      [WORKER_SCOPE_FILE]: '{ "context": "claims" }\n',
    },
  },
  {
    ruleId: 'persistence/migration-history',
    name: 'a working migration merged into the trunk without being generated again',
    expect: { file: 'migrations/20261015101500_working-add-claims.js' },
    files: knex(['20261012093000_initial', '20261015101500_working-add-claims']),
  },
];

/** A drizzle-kit project with three migrations; `payments` names the snapshot the third one was generated from. */
function drizzle(payments: string, order: readonly string[] = [INITIAL, INVOICES, PAYMENTS]): Record<string, string> {
  return project(
    {
      [`migrations/${INITIAL}.sql`]: 'CREATE TABLE "accounts" ("id" text PRIMARY KEY);\n',
      [`migrations/${INVOICES}.sql`]: 'CREATE TABLE "invoices" ("id" text PRIMARY KEY);\n',
      [`migrations/${PAYMENTS}.sql`]: 'CREATE TABLE "payments" ("id" text PRIMARY KEY);\n',
      'migrations/meta/20261010120000_snapshot.json': snapshot('a', ORIGIN),
      'migrations/meta/20261011120000_snapshot.json': snapshot('b', 'a'),
      'migrations/meta/20261012120000_snapshot.json': snapshot('c', payments),
      [JOURNAL]: journal(order.map((tag) => [tag, Number(tag.slice(0, 14))])),
    },
    { [CONFIG_FILE]: config({ stack: { orm: 'drizzle' } }) },
  );
}

function snapshot(id: string, prevId: string): string {
  return JSON.stringify({ id, prevId, version: '7', dialect: 'postgresql', tables: {} }, null, 2);
}

function journal(tags: readonly (readonly [tag: string, when: number])[]): string {
  const entries = tags.map(([tag, when], idx) => ({ idx, version: '7', when, tag, breakpoints: true }));

  return JSON.stringify({ version: '7', dialect: 'postgresql', entries }, null, 2);
}

function knex(names: readonly string[]): Record<string, string> {
  const migration = 'export const up = async () => {};\n\nexport const down = async () => {};\n';

  return project(Object.fromEntries(names.map((name) => [`migrations/${name}.js`, migration])), {
    [CONFIG_FILE]: config({ stack: { orm: 'knex' } }),
  });
}
