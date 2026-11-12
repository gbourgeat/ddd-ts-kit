import type { ReadModelTableShape } from './read-model-table-shape';

const SCHEMA = 'tables_contract';

const STAMP =
  'last_event_id text not null, last_event_at timestamptz not null, last_event_version bigint, deleted boolean not null default false';

/** A table of the contract: the statement that creates it, and how a member declares it to its read model table. */
interface ContractTable {
  readonly shape: ReadModelTableShape;
  readonly created: string;
}

const table = (shape: ReadModelTableShape, columns: string): ContractTable => ({
  shape,
  created: `create table ${SCHEMA}.${shape.table} (${columns})`,
});

/**
 * The tables `readModelTablesContract` creates, in its own schema, each a way a read model table
 * meets the trace of a deleted row. Exported for a member whose definitions are declared before
 * the database is opened (the entities of TypeORM): one definition per shape.
 */
export const READ_MODEL_TABLE_SHAPES = {
  schema: SCHEMA,
  /** As the kit writes it since a deleted row keeps no data. */
  ready: table(
    { table: 'ready_rows', key: 'id', fields: ['title'], tenant: 'tenant_id' },
    `id text primary key, title text, tenant_id text not null, ${STAMP}, constraint ready_rows_live_rows_whole check (deleted or (title is not null))`,
  ),
  /**
   * Declared before, and nothing like the table a generator writes: the key is a unique column and
   * not the primary key, which is an identity column the store does not map; so are a column the
   * database fills and one that belongs to somebody else. Two fields of the row refuse NULL.
   */
  agenda: table(
    { table: 'agenda', key: 'slug', fields: ['status', 'starts_at', 'note'], tenant: 'tenant_id' },
    `id bigint generated always as identity primary key, slug text not null unique, status text not null, starts_at text not null, note text, tenant_id text not null, created_at timestamptz not null default now(), owner text not null default 'nobody', ${STAMP}`,
  ),
  /** The tenant is kept in a column named otherwise. */
  network: table(
    { table: 'network_rows', key: 'id', fields: ['status'], tenant: 'network' },
    `id text primary key, status text not null, network text not null, ${STAMP}`,
  ),
  /** A migration stopped half-way: the constraint is there for one field, another still refuses NULL. */
  contacts: table(
    { table: 'contacts', key: 'id', fields: ['address', 'label'] },
    `id text primary key, address text not null, label text, ${STAMP}, constraint contacts_live_rows_whole check (deleted or (label is not null))`,
  ),
  /** A part of the primary key is mapped as a field of the row. */
  composite: table(
    { table: 'composite_rows', key: 'id', fields: ['region', 'title'] },
    `region text not null, id text not null unique, title text, ${STAMP}, primary key (region, id)`,
  ),
  /** A store of every tenant maps the tenant column as a field like another. */
  untenanted: table(
    { table: 'untenanted_rows', key: 'id', fields: ['tenant_id', 'title'] },
    `id text primary key, tenant_id text not null, title text, ${STAMP}`,
  ),
  /** An identity column and a generated one are mapped as fields of the row. */
  computed: table(
    { table: 'computed_rows', key: 'id', fields: ['serial', 'label', 'label_upper'] },
    `id text primary key, serial integer generated always as identity, label text, label_upper text generated always as (upper(label)) stored, ${STAMP}`,
  ),
  /** The definition names the columns of the stamp otherwise. */
  renamed: table(
    {
      table: 'renamed_rows',
      key: 'id',
      fields: ['title'],
      stamps: { lastEventId: 'evt_id', lastEventAt: 'evt_at', lastEventVersion: 'evt_version', deleted: 'removed' },
    },
    'id text primary key, title text not null, evt_id text not null, evt_at timestamptz not null, evt_version bigint, removed boolean not null default false',
  ),
  /** The database is ready, the definition of the store still declares the field NOT NULL. */
  strict: table(
    { table: 'strict_definition_rows', key: 'id', fields: ['title'], required: ['title'] },
    `id text primary key, title text, ${STAMP}`,
  ),
  /** Ready, with a constraint the tests add: not validated, or one that checks something else. */
  noted: table({ table: 'noted_rows', key: 'id', fields: ['title'] }, `id text primary key, title text, ${STAMP}`),
  /** Never created: its migration did not run. */
  absent: table({ table: 'absent_rows', key: 'id', fields: ['title'] }, ''),
} as const;
