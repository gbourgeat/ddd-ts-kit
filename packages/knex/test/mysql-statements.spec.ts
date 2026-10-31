import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UniqueViolationError } from '@ddd-ts-kit/kernel';
import { createOutboxTables, insertIgnoringConflict } from '../src';
import { FakeMySqlClient } from './support/mysql/fake-mysql-client';

/** The statements sent since the start, each in one line. */
function sentThrough(client: FakeMySqlClient): string[] {
  return client.statements.map(({ sql }) => sql.replace(/\s+/g, ' ').trim());
}

describe('the statements the kit sends to MySQL, without a server', () => {
  let database: Knex;
  let client: FakeMySqlClient;

  beforeEach(() => {
    database = knex({ client: FakeMySqlClient, connection: {} });
    client = database.client as FakeMySqlClient;
  });

  afterEach(async () => {
    await database.destroy();
  });

  it('creates the outbox tables in a database of the context, keyed as MySQL wants them', async () => {
    await createOutboxTables(database, { schema: 'messaging', tenant: true });

    const [namespace, outbox, pendingIndex, processed] = sentThrough(client);

    expect(namespace).toBe('create database if not exists `messaging`');
    expect(outbox).toContain('create table `messaging`.`outbox` (`id` varchar(191), ');
    expect(outbox).toContain('`sequence` bigint unsigned not null auto_increment unique');
    expect(outbox).toContain('`tenant_id` varchar(191)');
    expect(outbox).toContain('primary key (`id`))');

    expect(pendingIndex).toBe(
      'alter table `messaging`.`outbox` add index `outbox_pending_idx`(`status`, `next_attempt_at`, `sequence`)',
    );

    expect(processed).toContain('create table `messaging`.`processed_events`');
    expect(processed).toContain('primary key (`consumer`, `event_id`)');
  });

  it('inserts ignoring a conflict with INSERT IGNORE, and reads from the header whether it wrote', async () => {
    const row = { id: 'inv-1', amount: 100 };
    const invoices = () => database('invoices').withSchema('billing');

    expect(await insertIgnoringConflict(database, invoices(), { row, conflict: 'id' })).toBe(true);

    client.affectedRows = 0;
    client.rows = [{ id: 'inv-1' }];

    expect(await insertIgnoringConflict(database, invoices(), { row, conflict: ['id'] })).toBe(false);

    expect(sentThrough(client)).toEqual([
      'insert ignore into `billing`.`invoices` (`amount`, `id`) values (?, ?)',
      'insert ignore into `billing`.`invoices` (`amount`, `id`) values (?, ?)',
      'select `id` from `billing`.`invoices` where `id` = ? limit ?',
    ]);

    expect(client.statements[0]?.bindings).toEqual([100, 'inv-1']);
  });

  it('raises a UniqueViolationError when INSERT IGNORE skipped a row whose key no row holds: another unique value', async () => {
    client.affectedRows = 0;
    client.rows = [];

    const failure = await insertIgnoringConflict(database, database('invoices'), {
      row: { id: 'inv-2', number: 'F-1' },
      conflict: 'id',
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UniqueViolationError);
    expect(failure).toMatchObject({ code: 'CONFLICT' });
    expect(sentThrough(client).at(-1)).toBe('select `id` from `invoices` where `id` = ? limit ?');
  });
});
