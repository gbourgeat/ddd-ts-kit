import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isRecord } from '../init/is-record';

/** What `createTables` builds and the migrations of the project do not. */
export interface KnexSchemaDifference {
  /** The SQL that closes the difference, in the order it runs: every line was run on the migrations replayed. */
  readonly statements: readonly string[];
  /** What differs and no statement closes: a column, a table, an index, a constraint, a trigger, an enum, a function or a view. */
  readonly unwritten: readonly string[];
  /** Statements of `createTables` that belong to no migration: they change rows, remove something, or concern what exists. */
  readonly reported: readonly string[];
}

/** The variable that names the compiled schema and where the answer goes to the process that compares. */
const RUN_VARIABLE = 'DDD_TS_KIT_KNEX_DIFFERENCE';

/**
 * Compares, on two PostgreSQL started in process, what `createTables` builds on an empty database
 * and what the migrations build. A statement that creates or adds runs on the migrated side, and
 * the one that answers that its object exists is left out; the others are the migration. A column
 * of a table the migrations created is added first, since a constraint of `createTables` may name
 * it. Any other statement goes in only for a table or a column this migration brings: `createTables`
 * runs whole on an empty database, a migration only once on a database that holds data, so a
 * statement that changes rows or removes something is reported, and never runs. Every object is
 * then compared by the definition PostgreSQL gives of it, which is what sees one changed under its
 * name. It is a process of its own, started in the project, so that it uses the PGlite and the
 * knex the project installed, and it needs no server.
 */
const COMPARE = String.raw`const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const EXISTS = new Set(['42P06', '42P07', '42701', '42710', '42723', '42P16']);
const ROWS = /^\s*(insert|update|delete|truncate|merge|copy)\b|^\s*with\b.*\b(insert|update|delete|merge)\b/is;
const READS = /^\s*(select|with|set|show|begin|commit|rollback|savepoint|release)\b/i;
const DROPS = /^\s*drop\b|^\s*alter\s+\w+\s+(?:if\s+exists\s+)?(?:only\s+)?\S+\s+(?:drop|rename)\b/is;
const ADDS = /^\s*(?:create\b|alter\s+(?:table|type)\s+(?:if\s+exists\s+)?(?:only\s+)?\S+\s+add\b)/is;
const SYSTEM = "('pg_catalog', 'information_schema', 'pg_toast')";
const CATALOG = "select n.nspname as schema, c.relname as table, a.attname as column, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull as required, a.attgenerated <> '' as generated, pg_get_expr(d.adbin, d.adrelid) as value from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped and n.nspname not in " + SYSTEM + " and c.relname not like 'knex_migrations%' order by 1, 2, a.attnum";
const OBJECTS = [
  "select 'index ' || schemaname || '.' || indexname as name, schemaname || '.' || tablename as owner, indexdef as definition from pg_indexes where schemaname not in " + SYSTEM + " and tablename not like 'knex_migrations%'",
  "select 'constraint ' || n.nspname || '.' || c.relname || '.' || k.conname, n.nspname || '.' || c.relname, pg_get_constraintdef(k.oid) from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in " + SYSTEM + " and c.relname not like 'knex_migrations%'",
  "select 'trigger ' || n.nspname || '.' || c.relname || '.' || t.tgname, n.nspname || '.' || c.relname, pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname not in " + SYSTEM,
  "select 'enum ' || n.nspname || '.' || t.typname, null, string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace group by n.nspname, t.typname",
  "select 'function ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', null, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.prokind = 'f' and n.nspname not in " + SYSTEM,
  "select 'view ' || schemaname || '.' || viewname, null, definition from pg_views where schemaname not in " + SYSTEM,
].join(' union all ');
const unguarded = (sql) => sql.replace(/^(\s*create\s+(?:\w+\s+)+?)if\s+not\s+exists\s+/i, '$1').replace(/^(\s*create\s+)or\s+replace\s+/i, '$1');
const escaped = (sql) => sql.replace(/\?/g, '\\?');
const quoted = (name) => '"' + name.replace(/"/g, '""') + '"';
const tableOf = (row) => quoted(row.schema) + '.' + quoted(row.table);
const tableKey = (row) => row.schema + '.' + row.table;
const keyOf = (row) => tableKey(row) + '.' + row.column;
const shapeOf = (row) => row.type + (row.required ? ' not null' : '') + (row.value === null ? '' : (row.generated ? ' generated always as (' + row.value + ') stored' : ' default ' + row.value));
const addColumn = (row) => 'alter table ' + tableOf(row) + ' add column ' + quoted(row.column) + ' ' + shapeOf(row);
const byKey = (rows) => new Map(rows.map((row) => [keyOf(row), row]));
const tablesOf = (rows) => new Set(rows.map(tableKey));
const namesIn = (sql) => sql.toLowerCase().replace(/"/g, '').split(/[^\w.$]+/).flatMap((name) => [name, name.split('.').slice(0, 2).join('.')]);
(async () => {
  const { schema, answer } = JSON.parse(process.env.${RUN_VARIABLE});
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const { default: knex } = await import('knex');
  const { default: settings } = await import(pathToFileURL(path.resolve('knexfile.js')).href);
  const { createTables } = await import(pathToFileURL(path.resolve(schema)).href);
  const open = async () => {
    const engine = await PGlite.create();
    const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });
    await server.start();
    const connection = 'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres';
    const db = knex({ client: 'pg', connection, pool: { min: 0, max: 1 }, migrations: settings.migrations });
    return { db, close: async () => { await db.destroy(); await server.stop(); await engine.close(); } };
  };
  const catalog = async (db) => (await db.raw(CATALOG)).rows;
  const objects = async (db) => new Map((await db.raw(OBJECTS)).rows.map((row) => [row.name, row]));
  const statements = [];
  const empty = await open();
  // The event gives the SQL as the driver takes it, $1 and its bindings: each value is quoted by the client, as knex would.
  const inlined = (sql, bindings) => sql.replace(/\$(\d+)/g, (placeholder, index) => (Number(index) <= bindings.length ? empty.db.raw('?', [bindings[Number(index) - 1]]).toString() : placeholder));
  empty.db.on('query', ({ sql, bindings }) => {
    if (ROWS.test(sql) || !READS.test(sql)) statements.push(bindings && bindings.length > 0 ? inlined(sql, bindings) : sql);
  });
  await createTables(empty.db);
  const wanted = await catalog(empty.db);
  const wantedObjects = await objects(empty.db);
  await empty.close();
  const migrated = await open();
  if (fs.existsSync(path.resolve(settings.migrations.directory))) await migrated.db.migrate.latest();
  const before = await catalog(migrated.db);
  const present = byKey(before);
  const existing = tablesOf(before);
  const brought = new Set(wanted.filter((row) => !existing.has(tableKey(row))).flatMap((row) => (row.schema === 'public' ? [tableKey(row), row.table] : [tableKey(row)])));
  const added = [];
  const unwritten = [];
  const reported = [];
  const attempt = async (sql) => {
    try {
      await migrated.db.raw(escaped(sql));
      return undefined;
    } catch (error) {
      return error;
    }
  };
  for (const row of wanted.filter((row) => existing.has(tableKey(row)) && !present.has(keyOf(row)))) {
    const statement = addColumn(row);
    const error = await attempt(statement);
    if (error === undefined) {
      added.push(statement);
      brought.add(keyOf(row));
    } else unwritten.push('column ' + keyOf(row) + ' cannot be added: ' + error.message);
  }
  const kept = [];
  for (const statement of statements) {
    if (ROWS.test(statement)) reported.push('this statement of createTables changes rows, and a migration runs on a database that holds some: ' + statement);
    else if (DROPS.test(statement)) reported.push('this statement of createTables removes something, which no migration does unasked: ' + statement);
    else if (ADDS.test(statement) || namesIn(statement).some((name) => brought.has(name))) {
      const error = await attempt(unguarded(statement));
      if (error === undefined) kept.push(statement);
      else if (!EXISTS.has(error.code)) unwritten.push('this statement fails on the migrations: ' + statement + ' (' + error.message + ')');
    } else reported.push('this statement of createTables concerns what the migrations already hold, and may or may not be new: ' + statement);
  }
  const after = byKey(await catalog(migrated.db));
  const builtObjects = await objects(migrated.db);
  const schemaColumns = byKey(wanted);
  const schemaTables = tablesOf(wanted);
  for (const row of wanted) {
    const built = after.get(keyOf(row));
    if (built !== undefined && shapeOf(built) !== shapeOf(row)) unwritten.push('column ' + keyOf(row) + ' is ' + shapeOf(built) + ' in the migrations and ' + shapeOf(row) + ' in createTables');
  }
  for (const table of tablesOf([...after.values()])) {
    if (!schemaTables.has(table)) unwritten.push('table ' + table + ' is in the migrations and no longer in createTables');
  }
  for (const [key, row] of after) {
    if (schemaTables.has(tableKey(row)) && !schemaColumns.has(key)) unwritten.push('column ' + key + ' is in the migrations and no longer in createTables');
  }
  for (const [name, object] of wantedObjects) {
    const built = builtObjects.get(name);
    if (built !== undefined && built.definition !== object.definition) unwritten.push(name + ' is ' + built.definition + ' in the migrations and ' + object.definition + ' in createTables');
  }
  for (const [name, object] of builtObjects) {
    if (!wantedObjects.has(name) && (object.owner === null || schemaTables.has(object.owner))) unwritten.push(name + ' is in the migrations and no longer in createTables');
  }
  await migrated.close();
  fs.writeFileSync(answer, JSON.stringify({ statements: [...added, ...kept], unwritten, reported }));
  process.exit(0);
})().catch((error) => {
  console.error('The schema could not be compared with the migrations: ' + (error && error.message ? error.message : error));
  console.error('A migration or a table of createTables fails on the PostgreSQL in process of the tests. To write the migration by hand: npm run db:generate -- <what-it-does> --custom.');
  process.exit(1);
});`;

/** Answers the difference, or the exit code of a comparison that failed, which has said why. */
export function knexSchemaDifference(root: string, schema: string): KnexSchemaDifference | number {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'knex-difference-'));
  const answer = path.join(scratch, 'difference.json');

  try {
    const { status } = spawnSync(process.execPath, ['-e', COMPARE], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, [RUN_VARIABLE]: JSON.stringify({ schema, answer }) },
    });

    return status === 0 ? differenceIn(answer) : (status ?? 1);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function differenceIn(answer: string): KnexSchemaDifference {
  const read: unknown = JSON.parse(fs.readFileSync(answer, 'utf8'));
  const { statements, unwritten, reported } = isRecord(read) ? read : {};

  return { statements: linesOf(statements), unwritten: linesOf(unwritten), reported: linesOf(reported) };
}

function linesOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string') : [];
}
