import { readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaUnitOfWork } from '@ddd-ts-kit/prisma';
import { auditTablesSql } from '../../src/sql/audit-tables-sql';
import { databaseError } from '../../src/prisma/database-error';
import { PrismaAuditTrail, auditGuardStatements } from '../../src/prisma';
import type { AuditTrailOptions } from '../../src';
import { auditTrailContract } from '../../src/testing';
import { PrismaClient } from '../generated/client/client';
import { startPostgres, type TestPostgres } from '../support/postgres';
import { AUDIT_DDL_PATH } from '../support/prisma/generate';
import { sqlTrailSpecs } from '../support/sql-trail-specs';
import { REAL_SERVER, aRecord, type SqlTrailFixture } from '../support/sql-trail-fixture';

const runner = { describe, it, expect, beforeEach };

let postgres: TestPostgres;
let pool: pg.Pool;
let db: PrismaClient;
let elsewhere: PrismaClient;

beforeAll(async () => {
  postgres = await startPostgres();
  pool = new pg.Pool({ connectionString: postgres.url, max: 1 });

  const connect = () =>
    new PrismaClient({ adapter: new PrismaPg({ connectionString: postgres.url, max: postgres.poolSize }) });

  db = connect();
  elsewhere = postgres.real ? connect() : db;
});

afterAll(async () => {
  await db.$disconnect();

  if (elsewhere !== db) {
    await elsewhere.$disconnect();
  }

  await pool.end();
  await postgres.stop();
});

let schemas = 0;

/** A schema per test, with the tables and the guard the package gives: the entries cannot be truncated between two tests. */
async function freshSchema(): Promise<string> {
  schemas += 1;
  const schema = `audit_${schemas}`;

  for (const statement of auditTablesSql({ schema })) {
    await pool.query(statement);
  }

  return schema;
}

async function fixture(options: AuditTrailOptions = {}): Promise<SqlTrailFixture> {
  const schema = await freshSchema();

  const on = (client: PrismaClient) => {
    const unitOfWork = createPrismaUnitOfWork(client);

    return {
      unitOfWork,
      trail: new PrismaAuditTrail(unitOfWork, { ...options, schema }),
      run: async (statement: string) => {
        try {
          const rows: unknown = await unitOfWork.client().$queryRawUnsafe(inSchema(statement, schema));

          return { rows: Array.isArray(rows) ? rows : [] };
        } catch (error) {
          throw databaseError(error);
        }
      },
    };
  };

  return { ...on(db), elsewhere: () => on(elsewhere) };
}

function inSchema(statement: string, schema: string): string {
  return statement.replaceAll('$table', `"${schema}"."audit_entries"`).replaceAll('$schema', `"${schema}"`);
}

let current: SqlTrailFixture;

auditTrailContract(runner, {
  name: 'PrismaAuditTrail in a schema of its own',
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

sqlTrailSpecs({ name: 'PrismaAuditTrail', real: REAL_SERVER, create: fixture });

describe('auditPrismaModels', () => {
  it('create, through the migrations of the project, the columns, the keys and the indexes of the SQL of the package', async () => {
    await pool.query(await readFile(AUDIT_DDL_PATH, 'utf8'));

    for (const statement of auditTablesSql({ schema: 'audit_reference' })) {
      await pool.query(statement);
    }

    expect(await shapeOf('audit')).toEqual(await shapeOf('audit_reference'));
  });

  it('take the guard of the package in a migration by hand: the entries refuse to be rewritten', async () => {
    for (const statement of auditGuardStatements('audit')) {
      await pool.query(statement);
    }

    const trail = new PrismaAuditTrail(createPrismaUnitOfWork(db), { schema: 'audit' });

    await trail.record(aRecord('entry-1'));

    await expect(pool.query('delete from "audit"."audit_entries"')).rejects.toThrow('append-only');
  });
});

/** The columns, their types and nullability, and the indexes of the two tables of a schema. */
async function shapeOf(schema: string): Promise<unknown> {
  const columns = await pool.query(
    `select table_name, column_name, data_type, is_nullable, datetime_precision from information_schema.columns
     where table_schema = $1 order by table_name, column_name`,
    [schema],
  );

  const indexes = await pool.query(
    `select indexname, regexp_replace(indexdef, '"?' || $1 || '"?\\.', '', 'g') as definition from pg_indexes
     where schemaname = $1 and indexname not like '%_pkey' and indexname not like '%_key' order by indexname`,
    [schema],
  );

  return { columns: columns.rows, indexes: indexes.rows };
}

describe('PrismaAuditTrail, the errors of the database', () => {
  it('rolls back to its savepoint an append refused inside a unit of work, with the code of PostgreSQL', async () => {
    const { trail, unitOfWork } = await fixture();

    await trail.record(aRecord('entry-1'));

    const refused = unitOfWork.run(async () => {
      await trail.record(aRecord('entry-1'));
    });

    await expect(refused).rejects.toMatchObject({ code: '23505' });
  });

  it('answers an error that is not one of the database as it is', () => {
    const error = new Error('connection lost');

    expect(databaseError(error)).toBe(error);

    expect(databaseError({ meta: { driverAdapterError: { cause: { originalCode: '40001' } } } })).toMatchObject({
      code: '40001',
      message: 'PostgreSQL error 40001',
    });
  });

  it('refuses a context whose client outside a transaction cannot open one', async () => {
    const context = {
      client: () => ({ $queryRawUnsafe: async () => [], $executeRawUnsafe: async () => 0 }),
      inTransaction: () => false,
    };

    await expect(new PrismaAuditTrail(context).record(aRecord('entry-1'))).rejects.toThrow('it is not the root client');
  });
});
