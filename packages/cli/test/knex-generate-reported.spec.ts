import { describe, expect, it } from 'vitest';
import { write } from './helpers';
import {
  COMPILED,
  generate,
  INSTALLED,
  INVOICES,
  knexProject,
  migrationNamed,
  migrations,
  ORDERS,
  schemaOf,
} from './support/knex-project';

const WITH_STATUS = ORDERS.replace("table.integer('version')", "table.text('status');\n    table.integer('version')");

/** The migration under a name, the lines that run: what a comment says does not reach the database. */
function runningLines(root: string, name: string): string {
  return migrationNamed(root, name)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

describe.runIf(INSTALLED)('what db:generate writes of a statement of createTables that is not a definition', () => {
  it('quotes the values of a statement with bindings exactly where it reports it', () => {
    const seed = `await knex.raw('insert into ordering.orders (id, version, status) values (?, ?, ?)', ["o'k", 1, 'a\\\\b']);`;
    const root = knexProject(WITH_STATUS, seed);

    expect(generate(root, 'initial').code).toBe(0);

    const migration = migrationNamed(root, 'initial');

    expect(migration).toContain(`values ('o''k', 1, E'a\\\\b')`);
    expect(runningLines(root, 'initial')).not.toContain('insert');
  }, 180_000);

  it('fails and writes nothing on a definition with a binding, which PostgreSQL refuses in the tests of the project too', () => {
    const check = `await knex.raw('alter table ordering.orders add constraint orders_status check (status <> ?)', ["o'k"]);`;
    const root = knexProject(WITH_STATUS, check);

    expect(generate(root, 'initial').code).toBe(1);
    expect(migrations(root)).toEqual([]);
  }, 180_000);

  it('reports an insert as a TODO(domain) and never runs it, in the first migration or in a later one', () => {
    const seed = "await knex('ordering.orders').insert({ id: 'seed', version: 1 });";
    const root = knexProject(ORDERS, seed);

    expect(generate(root, 'initial').code).toBe(0);
    expect(runningLines(root, 'initial')).not.toContain('insert');
    expect(migrationNamed(root, 'initial')).toMatch(/TODO\(domain\).*insert into/);

    write(root, COMPILED, schemaOf(ORDERS, seed, INVOICES));
    expect(generate(root, 'add-invoices').code).toBe(0);
    expect(runningLines(root, 'add-invoices')).not.toContain('insert');
  }, 180_000);

  it('writes no migration for a statement that changes rows alone, and says so', () => {
    const seed = "await knex('ordering.orders').insert({ id: 'seed', version: 1 });";
    const root = knexProject(ORDERS);

    generate(root, 'initial');
    write(root, COMPILED, schemaOf(ORDERS, seed));

    const again = generate(root, 'seed');

    expect(again.stderr).toContain('insert into');
    expect(migrations(root)).toHaveLength(1);
  }, 180_000);

  it('writes row security and a comment with the table they belong to, and never again', () => {
    const security = `await knex.raw('alter table ordering.orders enable row level security');
  await knex.raw("comment on table ordering.orders is 'one purchase'");`;

    const root = knexProject(ORDERS, security);

    generate(root, 'initial');
    expect(runningLines(root, 'initial')).toContain('enable row level security');
    expect(runningLines(root, 'initial')).toContain('comment on table');

    write(root, COMPILED, schemaOf(ORDERS, security, INVOICES));
    generate(root, 'add-invoices');

    const later = runningLines(root, 'add-invoices');

    expect(later).toContain('"invoices"');
    expect(later).not.toContain('enable row level security');
    expect(later).not.toContain('comment on table');
  }, 180_000);

  it('never writes a drop of createTables as a statement: it is a TODO(domain)', () => {
    const drop = "await knex.raw('drop table if exists ordering.legacy');";
    const root = knexProject(ORDERS);

    generate(root, 'initial');
    write(root, COMPILED, schemaOf(ORDERS, drop, INVOICES));

    expect(generate(root, 'add-invoices').code).toBe(0);
    expect(runningLines(root, 'add-invoices')).not.toContain('drop table');
    expect(migrationNamed(root, 'add-invoices')).toMatch(/TODO\(domain\).*drop table if exists ordering\.legacy/);
  }, 180_000);
});

describe.runIf(INSTALLED)('what db:generate says of an object changed under its name', () => {
  it('reports an index', () => {
    const root = knexProject(ORDERS, INVOICES);

    generate(root, 'initial');
    write(root, COMPILED, schemaOf(ORDERS, INVOICES.replace("['tenant_id', 'id']", "['id', 'tenant_id']")));

    const result = generate(root, 'reorder-index');

    expect(result.stderr).toContain('index ordering.invoices_tenant_idx');
    expect(migrationNamed(root, 'reorder-index')).toContain('TODO(domain): write this change by hand: index ordering');
  }, 180_000);

  it('reports a constraint', () => {
    const check = (value: string): string =>
      `await knex.raw("alter table ordering.orders add constraint orders_status check (status <> '${value}')");`;

    const root = knexProject(WITH_STATUS, check('a'));

    generate(root, 'initial');
    write(root, COMPILED, schemaOf(WITH_STATUS, check('b')));
    generate(root, 'change-check');

    expect(migrationNamed(root, 'change-check')).toContain('constraint ordering.orders.orders_status');
  }, 180_000);

  it('reports an enum', () => {
    const kinds = (...labels: readonly string[]): string =>
      `await knex.raw("create type ordering.kind as enum (${labels.map((label) => `'${label}'`).join(', ')})");`;

    const root = knexProject(kinds('a'));

    generate(root, 'initial');
    write(root, COMPILED, schemaOf(kinds('a', 'b')));
    generate(root, 'add-kind');

    expect(migrationNamed(root, 'add-kind')).toContain('enum ordering.kind');
  }, 180_000);
});

describe.runIf(INSTALLED)('the arguments of db:generate under pnpm', () => {
  it('reads --custom after the `--` pnpm forwards, and writes the empty migration', () => {
    const root = knexProject(ORDERS);

    expect(generate(root, 'fill', '--', '--custom').code).toBe(0);
    expect(migrationNamed(root, 'fill')).not.toContain('create table');
  }, 180_000);
});
