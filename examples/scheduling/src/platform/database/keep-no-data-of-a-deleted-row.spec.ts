import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keepNoDataOfADeletedRow } from '@/platform/database/keep-no-data-of-a-deleted-row';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';

/** What a deleted row keeps: its key, its network and its stamp. */
const KEPT = ['id', 'recipient_id', 'tenant_id', 'last_event_id', 'last_event_at', 'deleted'];

const READ_MODELS = [
  'scheduling.practitioners',
  'scheduling.agenda',
  'scheduling.attendance_history',
  'notification.contacts',
  'analytics.outcomes',
];

interface Column {
  readonly table_schema: string;
  readonly table_name: string;
  readonly column_name: string;
}

let database: TestDatabase;
let knex: Knex;

beforeAll(async () => {
  database = await openTestDatabase();
  knex = database.persistence.database.executor();
});

afterAll(async () => {
  await database.close();
});

describe('The data of a deleted row of a read model', () => {
  it('may be NULL in every column of the row: only the key, the network and the stamp refuse it', async () => {
    const required = await knex<Column>('information_schema.columns')
      .select('table_schema', 'table_name', 'column_name')
      .where('is_nullable', 'NO')
      .whereIn('table_schema', ['scheduling', 'notification', 'analytics']);

    const ofReadModels = required.filter((column) =>
      READ_MODELS.includes(`${column.table_schema}.${column.table_name}`),
    );

    expect(ofReadModels.length).toBeGreaterThan(0);
    expect(ofReadModels.filter((column) => !KEPT.includes(column.column_name))).toEqual([]);
  });

  it('is emptied in the rows deleted before, and the migration run again changes nothing more', async () => {
    const contacts = () => knex('contacts').withSchema(NOTIFICATION_SCHEMA);

    await contacts().insert([contact('gone', true, 'gone@example.org'), contact('here', false, 'here@example.org')]);
    await keepNoDataOfADeletedRow(knex);
    await keepNoDataOfADeletedRow(knex);

    expect(await contacts().select('recipient_id', 'address').orderBy('recipient_id')).toEqual([
      { recipient_id: 'gone', address: null },
      { recipient_id: 'here', address: 'here@example.org' },
    ]);
  });

  it('is still required of a live row, by the check constraint of its table', async () => {
    const written = knex('contacts')
      .withSchema(NOTIFICATION_SCHEMA)
      .insert(contact('nobody', false, null));

    await expect(written).rejects.toThrow('contacts_live_rows');
  });
});

function contact(recipient: string, deleted: boolean, address: string | null) {
  return {
    recipient_id: recipient,
    address,
    tenant_id: 'north',
    last_event_id: 'evt-1',
    last_event_at: new Date('2026-11-11T09:00:00.000Z'),
    deleted,
  };
}
