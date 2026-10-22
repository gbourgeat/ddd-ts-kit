import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createKnexUnitOfWork } from '@ddd-ts-kit/knex';
import { KnexAuditTrail, createAuditTables, dropAuditTables } from '../src/knex';
import type { AuditTrailOptions } from '../src';
import { auditTrailContract } from '../src/testing';
import { startPostgres, type TestPostgres } from './support/postgres';
import { sqlTrailSpecs } from './support/sql-trail-specs';
import { REAL_SERVER, aRecord, type SqlTrailFixture } from './support/sql-trail-fixture';

const runner = { describe, it, expect, beforeEach };

let postgres: TestPostgres;
let db: Knex;
let elsewhere: Knex;

beforeAll(async () => {
  postgres = await startPostgres();
  const connect = () => knex({ client: 'pg', connection: postgres.url, pool: { min: 0, max: postgres.poolSize } });

  db = connect();
  elsewhere = postgres.real ? connect() : db;
});

afterAll(async () => {
  await db.destroy();

  if (elsewhere !== db) {
    await elsewhere.destroy();
  }

  await postgres.stop();
});

let schemas = 0;

/** A schema per test: the entries cannot be truncated between two of them, which is the point. */
async function freshSchema(): Promise<string> {
  schemas += 1;
  const schema = `audit_${schemas}`;

  await createAuditTables(db, { schema });

  return schema;
}

async function fixture(options: AuditTrailOptions = {}): Promise<SqlTrailFixture> {
  const schema = await freshSchema();

  const on = (database: Knex) => {
    const unitOfWork = createKnexUnitOfWork(database);

    return {
      unitOfWork,
      trail: new KnexAuditTrail(unitOfWork, { ...options, schema }),
      run: (statement: string) => unitOfWork.executor().raw(inSchema(statement, schema)),
    };
  };

  return { ...on(db), elsewhere: () => on(elsewhere) };
}

function inSchema(statement: string, schema: string): string {
  return statement.replaceAll('$table', `"${schema}"."audit_entries"`).replaceAll('$schema', `"${schema}"`);
}

let current: SqlTrailFixture;

auditTrailContract(runner, {
  name: 'KnexAuditTrail in a schema of its own',
  createTrail: async () => {
    current = await fixture();

    return current.trail;
  },
  tamper: async (entry, action) => {
    await current.run('alter table $table disable trigger "audit_entries_no_rewrite"');
    await current.run(`update $table set "action" = '${action}' where "id" = '${entry.id}'`);
    await current.run('alter table $table enable trigger "audit_entries_no_rewrite"');
  },
});

auditTrailContract(runner, {
  name: 'KnexAuditTrail in the default schema',
  createTrail: async () => {
    await dropAuditTables(db);
    await createAuditTables(db);

    return new KnexAuditTrail(createKnexUnitOfWork(db));
  },
});

sqlTrailSpecs({ name: 'KnexAuditTrail', real: REAL_SERVER, create: fixture });

describe('createAuditTables', () => {
  it('creates the two tables, the indexes of the reader and the guard, in the given schema', async () => {
    const schema = await freshSchema();

    const { rows: indexes } = await db.raw<{ rows: { indexname: string }[] }>(
      'select indexname from pg_indexes where schemaname = ? order by indexname',
      [schema],
    );

    const { rows: triggers } = await db.raw<{ rows: { tgname: string }[] }>(
      `select tgname from pg_trigger where tgrelid = '"${schema}"."audit_entries"'::regclass and not tgisinternal order by tgname`,
    );

    expect(indexes.map((row) => row.indexname)).toEqual([
      'audit_chains_pkey',
      'audit_entries_actor_idx',
      'audit_entries_correlation_idx',
      'audit_entries_id_key',
      'audit_entries_occurred_idx',
      'audit_entries_pkey',
      'audit_entries_resource_idx',
    ]);

    expect(triggers.map((row) => row.tgname)).toEqual(['audit_entries_no_rewrite', 'audit_entries_no_truncate']);
  });

  it('is undone by dropAuditTables, guard included', async () => {
    const schema = await freshSchema();

    await new KnexAuditTrail(createKnexUnitOfWork(db), { schema }).record(aRecord('entry-1'));

    await dropAuditTables(db, { schema });

    expect(await db.schema.withSchema(schema).hasTable('audit_entries')).toBe(false);
    expect(await db.schema.withSchema(schema).hasTable('audit_chains')).toBe(false);

    const { rows } = await db.raw<{ rows: unknown[] }>(
      `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ? and p.proname = 'audit_entries_append_only'`,
      [schema],
    );

    expect(rows).toEqual([]);
  });
});
