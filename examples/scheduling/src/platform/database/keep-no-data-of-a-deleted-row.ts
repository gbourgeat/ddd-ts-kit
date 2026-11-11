import type { Knex } from 'knex';
import { ANALYTICS_SCHEMA } from '@/contexts/analytics/infrastructure/persistence/analytics.schema';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/shared/infrastructure/persistence/scheduling.schema';

interface ReadModelTable {
  readonly schema: string;
  readonly table: string;
  /** The columns a live row always holds: they were NOT NULL when the table was created. */
  readonly live: readonly string[];
}

const STAMP = ['last_event_id', 'last_event_at', 'last_event_version', 'deleted'];

/** The tables of the read models: the key, the network and the stamp of a row are not among its `live` columns. */
const READ_MODELS: readonly ReadModelTable[] = [
  {
    schema: SCHEDULING_SCHEMA,
    table: 'practitioners',
    live: ['practice_id', 'practitioner_id', 'display_name', 'time_zone'],
  },
  {
    schema: SCHEDULING_SCHEMA,
    table: 'agenda',
    live: [
      'calendar_id',
      'practice_id',
      'practitioner_id',
      'patient_id',
      'appointment_type_id',
      'starts_at',
      'ends_at',
      'held_until',
      'day',
      'status',
      'changed_at',
    ],
  },
  { schema: SCHEDULING_SCHEMA, table: 'attendance_history', live: ['record_id', 'version', 'fact', 'noted_at'] },
  { schema: NOTIFICATION_SCHEMA, table: 'contacts', live: ['address'] },
  {
    schema: ANALYTICS_SCHEMA,
    table: 'outcomes',
    live: ['practice_id', 'calendar_id', 'day', 'starts_at', 'ends_at', 'state', 'changed_at'],
  },
];

/**
 * What the migration `20261111090000_keep-no-data-of-a-deleted-row` does, so that the in-process
 * database of the tests runs it too. A deleted row of a read model keeps its key, its network and
 * its stamp, and NULL in every other column: the columns of the row accept NULL, and a check
 * constraint keeps the live rows whole in their place. The rows deleted before are emptied.
 * Run twice, it changes nothing the second time.
 */
export async function keepNoDataOfADeletedRow(knex: Knex): Promise<void> {
  for (const readModel of READ_MODELS) {
    await acceptNull(knex, readModel);
    await keepLiveRowsWhole(knex, readModel);
    await emptyDeletedRows(knex, readModel);
  }
}

async function acceptNull(knex: Knex, { schema, table, live }: ReadModelTable): Promise<void> {
  await knex.schema.withSchema(schema).alterTable(table, (columns) => {
    for (const column of live) {
      columns.setNullable(column);
    }
  });
}

/** `check (deleted or (<column> is not null and ...))`: what NOT NULL said of a live row, and no more of a deleted one. */
async function keepLiveRowsWhole(knex: Knex, { schema, table, live }: ReadModelTable): Promise<void> {
  const constraint = `${table}_live_rows_whole`;
  const whole = live.map(() => '?? is not null').join(' and ');

  await knex.raw('alter table ??.?? drop constraint if exists ??', [schema, table, constraint]);

  await knex.raw(`alter table ??.?? add constraint ?? check (deleted or (${whole}))`, [
    schema,
    table,
    constraint,
    ...live,
  ]);
}

/** Every column of the row, the optional ones too: read from the table, the key, the network and the stamp left as they are. */
async function emptyDeletedRows(knex: Knex, { schema, table }: ReadModelTable): Promise<void> {
  const kept = new Set([...(await keyOf(knex, schema, table)), 'tenant_id', ...STAMP]);
  const columns = Object.keys(await knex(table).withSchema(schema).columnInfo());
  const emptied = Object.fromEntries(columns.filter((column) => !kept.has(column)).map((column) => [column, null]));

  await knex(table).withSchema(schema).where({ deleted: true }).update(emptied);
}

async function keyOf(knex: Knex, schema: string, table: string): Promise<string[]> {
  const { rows } = await knex.raw<{ rows: { column_name: string }[] }>(
    `select usage.column_name
       from information_schema.table_constraints as held
       join information_schema.key_column_usage as usage
         on usage.constraint_name = held.constraint_name and usage.table_schema = held.table_schema
      where held.constraint_type = 'PRIMARY KEY' and held.table_schema = ? and held.table_name = ?`,
    [schema, table],
  );

  return rows.map((row) => row.column_name);
}
