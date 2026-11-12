import type pg from 'pg';
import { KEPT_TABLES } from '{{alias.test}}/support/test-database-kept{{alias.ext}}';
import { codeOf, connectedTo, databaseOf } from '{{alias.test}}/support/test-database-server{{alias.ext}}';

/** What a run did to its copy of the migrated database. */
export interface Emptied {
  /** The tables it emptied that held rows. */
  readonly held: readonly string[];
  /** The tables it left with their rows because another role owns them. */
  readonly ofAnotherRole: readonly string[];
  /** The bytes the tables it emptied took. */
  readonly bytes: number;
}

interface Table {
  /** `<schema>.<table>`, as KEPT_TABLES names it. */
  readonly name: string;
  /** The same, as a statement names it. */
  readonly quoted: string;
  /** The role of the run may empty it: a truncate that restarts the sequences is the right of the owner. */
  readonly owned: boolean;
  readonly bytes: string;
}

/** The tables of the project: not those of the server, nor those of an extension, which keeps its own. */
const TABLES = `select n.nspname || '.' || c.relname as name, format('%I.%I', n.nspname, c.relname) as quoted,
    pg_has_role(c.relowner, 'USAGE') as owned, pg_total_relation_size(c.oid)::text as bytes
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and not c.relispartition
    and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_%'
    and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')`;

const REFERENCES = `select rn.nspname || '.' || r.relname as "from", fn.nspname || '.' || f.relname as "to"
  from pg_constraint k
  join pg_class r on r.oid = k.conrelid join pg_namespace rn on rn.oid = r.relnamespace
  join pg_class f on f.oid = k.confrelid join pg_namespace fn on fn.oid = f.relnamespace
  where k.contype = 'f'`;

/** The materialized views that hold a result and that the role may refresh, the oldest first: one may read another. */
const VIEWS = `select format('%I.%I', n.nspname, c.relname) as quoted
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'm' and c.relispopulated and pg_has_role(c.relowner, 'USAGE') order by c.oid`;

/**
 * Empties the copy `name` of the migrated database `url` names: every table of the project but
 * those KEPT_TABLES lists (test-database-kept.ts) and those another role owns, in one statement
 * and without `cascade`, so that a kept table is never emptied through a foreign key. A spec file
 * then starts from the tables of the migrated database and no row, as on PostgreSQL in process,
 * whatever a migration, an application or a spec stored there. The materialized views are
 * refreshed, so that none shows the rows that are gone. A sequence no column owns keeps its value.
 */
export async function emptied(url: string, name: string): Promise<Emptied> {
  const copy = await connectedTo(url, name);

  try {
    const tables = (await copy.query<Table>(TABLES)).rows;
    const emptying = tables.filter((table) => table.owned && !kept(table));

    if (tables.length === 0) {
      throw new Error(`The database "${databaseOf(url)}" holds no table: migrate it first (npm run db:migrate).`);
    }

    await refuseAReferenceFromAKeptTable(copy, tables, emptying);

    const held = await holdingRows(copy, emptying);

    await empty(copy, emptying);

    return {
      held,
      ofAnotherRole: tables.filter((table) => !table.owned && !kept(table)).map((table) => table.name),
      bytes: emptying.reduce((sum, table) => sum + Number(table.bytes), 0),
    };
  } catch (error) {
    throw codeOf(error) === '' ? error : notEmptied(databaseOf(url), error);
  } finally {
    await copy.end();
  }
}

function kept({ name }: Table): boolean {
  return KEPT_TABLES.includes(name) || KEPT_TABLES.includes(name.replace(/\.[^.]*$/, '.*'));
}

/** Without `cascade` the server refuses to empty a table that a table left with its rows references: said before, with both names. */
async function refuseAReferenceFromAKeptTable(copy: pg.Client, tables: readonly Table[], emptying: readonly Table[]): Promise<void> {
  const { rows } = await copy.query<{ from: string; to: string }>(REFERENCES);
  const ofTheProject = new Set(tables.map((table) => table.name));
  const gone = new Set(emptying.map((table) => table.name));
  const broken = rows.find(({ from, to }) => ofTheProject.has(from) && !gone.has(from) && gone.has(to));

  if (broken !== undefined) {
    throw new Error(
      `The table ${broken.from} keeps its rows and references ${broken.to}, which the run empties: keep ${broken.to} too, in KEPT_TABLES of test/support/test-database-kept.ts.`,
    );
  }
}

async function holdingRows(copy: pg.Client, emptying: readonly Table[]): Promise<string[]> {
  const each = emptying.map(
    ({ name, quoted }) => `select '${name.replaceAll("'", "''")}' as name where exists (select 1 from ${quoted})`,
  );

  if (emptying.length === 0) {
    return [];
  }

  return (await copy.query<{ name: string }>(each.join(' union all '))).rows.map((row) => row.name);
}

async function empty(copy: pg.Client, emptying: readonly Table[]): Promise<void> {
  if (emptying.length > 0) {
    await copy.query(`truncate table ${emptying.map((table) => table.quoted).join(', ')} restart identity`);
  }

  for (const view of (await copy.query<{ quoted: string }>(VIEWS)).rows) {
    await copy.query(`refresh materialized view ${view.quoted}`);
  }
}

function notEmptied(database: string, error: unknown): Error {
  return new Error(
    `The copy of the database "${database}" could not be emptied (${String(error)}): list the table it names in KEPT_TABLES of test/support/test-database-kept.ts, or give the tests a database of their own, migrated and empty.`,
    { cause: error },
  );
}
