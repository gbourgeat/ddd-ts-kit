import type pg from 'pg';
import { KEPT_TABLES } from './test-database-kept{{alias.sibling}}';
import { codeOf, connectedTo, databaseOf } from './test-database-server{{alias.sibling}}';

/** What a run did to its copy of the migrated database. */
export interface Emptied {
  /** The tables it emptied that held rows. */
  readonly held: readonly string[];
  /** The tables it left with their rows because the role of the run may not empty them. */
  readonly ofAnotherRole: readonly string[];
  /** The names of KEPT_TABLES that are no table of the copy. */
  readonly unmatched: readonly string[];
  /** The bytes the tables it emptied took. */
  readonly bytes: number;
}

interface Table {
  /** `<schema>.<table>`, as KEPT_TABLES names it and as the server stores it. */
  readonly name: string;
  /** The same, as a statement names it. */
  readonly quoted: string;
  /** The role of the run may empty it: it owns it, a truncate that restarts the sequences being the right of the owner, and may use its schema. */
  readonly owned: boolean;
  /** Its rows are in its partitions, which are emptied with it. */
  readonly partitioned: boolean;
  readonly bytes: string;
}

interface Link {
  readonly from: string;
  readonly to: string;
}

/** What a name of KEPT_TABLES looks like: a schema, then a table or `*`, as the server stores them, without quotes. */
const NAME = /^[^.*"]+\.(?:[^.*"]+|\*)$/;
/** What the generated list names that a project may not hold yet: nothing is said when one of these is no table. */
{{#if orm.drizzle}}
const MAY_BE_ABSENT = ['drizzle.__drizzle_migrations', 'audit.*'];
{{/if}}
{{#if orm.knex}}
const MAY_BE_ABSENT = ['public.knex_migrations', 'public.knex_migrations_lock', 'audit.*'];
{{/if}}
{{#if orm.prisma}}
const MAY_BE_ABSENT = ['public._prisma_migrations', 'audit.*'];
{{/if}}
{{#if orm.typeorm}}
const MAY_BE_ABSENT = ['public.migrations', 'public.typeorm_metadata', 'audit.*'];
{{/if}}

/** The tables of the project: not those of the server, nor those of an extension, which keeps its own, nor a partition, which goes with its table. */
const TABLES = `select n.nspname || '.' || c.relname as name, format('%I.%I', n.nspname, c.relname) as quoted,
    pg_has_role(c.relowner, 'USAGE') and has_schema_privilege(n.oid, 'USAGE') as owned,
    c.relkind = 'p' as partitioned, pg_total_relation_size(c.oid)::text as bytes
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and not c.relispartition
    and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_%'
    and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
  order by 1`;

const NAMED = (alias: string, name: string): string =>
  `join pg_class ${alias} on ${alias}.oid = ${name} join pg_namespace ${alias}n on ${alias}n.oid = ${alias}.relnamespace`;

const REFERENCES = `select rn.nspname || '.' || r.relname as "from", fn.nspname || '.' || f.relname as "to"
  from pg_constraint k ${NAMED('r', 'k.conrelid')} ${NAMED('f', 'k.confrelid')} where k.contype = 'f'`;

/** Each partition and the table it is a partition of. */
const PARTITIONS = `select rn.nspname || '.' || r.relname as "from", fn.nspname || '.' || f.relname as "to"
  from pg_inherits i ${NAMED('r', 'i.inhrelid')} ${NAMED('f', 'i.inhparent')} where r.relispartition`;

/** The materialized views that hold a result and that the role may refresh, the oldest first: one may read another. */
const VIEWS = `select format('%I.%I', n.nspname, c.relname) as quoted
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'm' and c.relispopulated and pg_has_role(c.relowner, 'USAGE') order by c.oid`;

/**
 * Empties the copy `name` of the migrated database `url` names: every table of the project but
 * those KEPT_TABLES lists (test-database-kept.ts) and those the role may not empty, in one
 * statement, without `cascade` and each table `only`, so that a kept table is never emptied
 * through a foreign key nor through the table it inherits from. A spec file then starts from the
 * tables of the migrated database and no row, as on PostgreSQL in process, whatever a migration,
 * an application or a spec stored there. The materialized views are refreshed, so that none shows
 * the rows that are gone. A sequence no column owns keeps its value.
 */
export async function emptied(url: string, name: string): Promise<Emptied> {
  const copy = await connectedTo(url, name);

  try {
    refuseAShapelessName();

    const tables = (await copy.query<Table>(TABLES)).rows;
    const emptying = tables.filter((table) => table.owned && !kept(table.name));

    if (tables.length === 0) {
      throw new Error(`The database "${databaseOf(url)}" holds no table: migrate it first (npm run db:migrate).`);
    }

    await refuseWhatAKeptTableLoses(copy, tables, emptying);

    const held = await holdingRows(copy, emptying);

    await empty(copy, emptying);

    return {
      held,
      ofAnotherRole: tables.filter((table) => !table.owned && !kept(table.name)).map((table) => table.name),
      unmatched: unmatched(tables),
      bytes: emptying.reduce((sum, table) => sum + Number(table.bytes), 0),
    };
  } catch (error) {
    throw codeOf(error) === '' ? error : notEmptied(databaseOf(url), error);
  } finally {
    await copy.end();
  }
}

function kept(name: string): boolean {
  return KEPT_TABLES.some((listed) => names(listed, name));
}

/** A listed name is the table, letter for letter, or its schema followed by `.*`. */
function names(listed: string, table: string): boolean {
  return listed === table || listed === table.replace(/\.[^.]*$/, '.*');
}

function unmatched(tables: readonly Table[]): string[] {
  return KEPT_TABLES.filter(
    (listed) => !MAY_BE_ABSENT.includes(listed) && !tables.some((table) => names(listed, table.name)),
  );
}

function refuseAShapelessName(): void {
  const shapeless = KEPT_TABLES.find((listed) => !NAME.test(listed));

  if (shapeless !== undefined) {
    throw new Error(
      `KEPT_TABLES of test/support/test-database-kept.ts holds "${shapeless}": a name is <schema>.<table>, or <schema>.* for every table of a schema, written as the server stores it and without quotes (a table created as "Countries" is public.Countries, one created as countries or Countries without quotes is public.countries).`,
    );
  }
}

/**
 * Said before the server refuses it without a name, or does it without a word: a table that keeps
 * its rows and references an emptied one, which no `cascade` empties for it, and a kept partition
 * of an emptied table, which goes with its table.
 */
async function refuseWhatAKeptTableLoses(
  copy: pg.Client,
  tables: readonly Table[],
  emptying: readonly Table[],
): Promise<void> {
  const partitions = (await copy.query<Link>(PARTITIONS)).rows;
  const tableOf = (name: string): string => partitions.find((partition) => partition.from === name)?.to ?? name;
  const rootOf = (name: string): string => (tableOf(name) === name ? name : rootOf(tableOf(name)));
  const gone = new Set(emptying.map((table) => table.name));

  const stays = (name: string): boolean =>
    tables.some((table) => table.name === rootOf(name)) && !gone.has(rootOf(name));

  const partition = partitions.map((link) => link.from).find((name) => kept(name) && gone.has(rootOf(name)));
  const broken = (await copy.query<Link>(REFERENCES)).rows.find(({ from, to }) => stays(from) && gone.has(rootOf(to)));
  const where = 'in KEPT_TABLES of test/support/test-database-kept.ts';

  if (partition !== undefined) {
    throw new Error(
      `The table ${partition} is a partition of ${rootOf(partition)}, which the run empties, and a partition is emptied with its table: keep ${rootOf(partition)} ${where}.`,
    );
  }

  if (broken !== undefined) {
    throw new Error(
      `The table ${rootOf(broken.from)} keeps its rows and references ${rootOf(broken.to)}, which the run empties: keep ${rootOf(broken.to)} too, ${where}.`,
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
  // `only`: a table that inherits from an emptied one and keeps its rows is not reached through it. A partitioned table has no rows of its own.
  const each = emptying.map((table) => (table.partitioned ? table.quoted : `only ${table.quoted}`));

  if (emptying.length > 0) {
    await copy.query(`truncate table ${each.join(', ')} restart identity`);
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
