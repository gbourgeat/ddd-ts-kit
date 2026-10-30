import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTypeOrmUnitOfWork } from '@ddd-ts-kit/typeorm';
import { auditTablesSql } from '../src/sql/audit-tables-sql';
import { TypeOrmAuditTrail, auditEntities, auditGuardStatements } from '../src/typeorm';
import type { AuditTrailOptions } from '../src';
import { archivableAuditTrailContract, auditTrailContract } from '../src/testing';
import { startPostgres, type TestPostgres } from './support/postgres';
import { archiveGuardSpecs, archiveSpecs, type ArchiveFixture } from './support/archive-specs';
import { sqlArchiveFixture } from './support/archive-fixture';
import { sqlTrailSpecs } from './support/sql-trail-specs';
import { REAL_SERVER, aRecord, type SqlTrailFixture } from './support/sql-trail-fixture';

const runner = { describe, it, expect, beforeEach };

let postgres: TestPostgres;
let db: DataSource;
let elsewhere: DataSource;

beforeAll(async () => {
  postgres = await startPostgres();
  const connect = () => new DataSource({ type: 'postgres', url: postgres.url, poolSize: postgres.poolSize });

  db = await connect().initialize();
  elsewhere = postgres.real ? await connect().initialize() : db;
});

afterAll(async () => {
  await db.destroy();

  if (elsewhere !== db) {
    await elsewhere.destroy();
  }

  await postgres.stop();
});

let schemas = 0;

/** A schema per test, with the tables and the guard the package gives: the entries cannot be truncated between two tests. */
async function freshSchema(): Promise<string> {
  schemas += 1;
  const schema = `audit_${schemas}`;

  for (const statement of auditTablesSql({ schema })) {
    await db.query(statement);
  }

  return schema;
}

async function fixture(options: AuditTrailOptions = {}): Promise<SqlTrailFixture> {
  const schema = await freshSchema();

  const on = (dataSource: DataSource) => {
    const unitOfWork = createTypeOrmUnitOfWork(dataSource);

    return {
      unitOfWork,
      trail: new TypeOrmAuditTrail(unitOfWork, { ...options, schema }),
      run: async (statement: string) => {
        const rows: unknown = await unitOfWork.manager().query(inSchema(statement, schema));

        return { rows: Array.isArray(rows) ? rows : [] };
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
  name: 'TypeOrmAuditTrail in a schema of its own',
  createTrail: async () => {
    current = await fixture();

    return current.trail;
  },
  tamper: async (entry, action) => {
    await current.run('alter table $table disable trigger "audit_entries_no_rewrite"');
    await current.run(`update $table set "action" = '${action}' where "id" = '${entry.id}'`);
    await current.run('alter table $table enable trigger "audit_entries_no_rewrite"');
  },
  cut: async (chain, fromSequence) => {
    await current.run('alter table $table disable trigger "audit_entries_no_rewrite"');
    await current.run(`delete from $table where "chain" = '${chain}' and "sequence" >= ${fromSequence}`);
    await current.run('alter table $table enable trigger "audit_entries_no_rewrite"');
  },
});

archivableAuditTrailContract(runner, {
  name: 'TypeOrmAuditTrail in a schema of its own',
  createTrail: async () => {
    current = await fixture();

    return current.trail;
  },
  cut: async (chain, fromSequence) => {
    await current.run('alter table $table disable trigger "audit_entries_no_rewrite"');
    await current.run(`delete from $table where "chain" = '${chain}' and "sequence" >= ${fromSequence}`);
    await current.run('alter table $table enable trigger "audit_entries_no_rewrite"');
  },
});

sqlTrailSpecs({ name: 'TypeOrmAuditTrail', real: REAL_SERVER, create: fixture });

describe('auditEntities', () => {
  it('create, through the migrations of the project, the columns, the keys and the indexes of the SQL of the package', async () => {
    const schema = 'audit_from_entities';
    const reference = 'audit_from_sql';

    await db.query(`create schema "${schema}"`);

    const synchronized = await new DataSource({
      type: 'postgres',
      url: postgres.url,
      poolSize: 1,
      entities: [...auditEntities({ schema })],
      synchronize: true,
    }).initialize();

    await synchronized.destroy();

    for (const statement of auditTablesSql({ schema: reference })) {
      await db.query(statement);
    }

    expect(await shapeOf(schema)).toEqual(await shapeOf(reference));
  });

  it('take the guard of the package in a migration by hand: the entries refuse to be rewritten', async () => {
    const schema = await freshSchema();
    const trail = new TypeOrmAuditTrail(createTypeOrmUnitOfWork(db), { schema });

    await trail.record(aRecord('entry-1'));

    await expect(db.query(`delete from "${schema}"."audit_entries"`)).rejects.toThrow('append-only');
    expect(auditGuardStatements(schema).join(';')).toContain('audit_entries_no_rewrite');
  });
});

/** The columns, their types and nullability, and the indexes of the two tables of a schema. */
async function shapeOf(schema: string): Promise<unknown> {
  const columns: unknown = await db.query(
    `select table_name, column_name, data_type, is_nullable, datetime_precision from information_schema.columns
     where table_schema = $1 order by table_name, column_name`,
    [schema],
  );

  const indexes: unknown = await db.query(
    `select indexname, regexp_replace(indexdef, '"?' || $1 || '"?\\.', '', 'g') as definition from pg_indexes
     where schemaname = $1 and indexname not like 'PK_%' and indexname not like 'UQ_%' and indexname not like '%_pkey' and indexname not like '%_key'
     order by indexname`,
    [schema],
  );

  return { columns, indexes };
}

/** The way an attacker with access to the database rewrites an entry: the guard set aside. */
async function tampered(current: SqlTrailFixture, id: string): Promise<void> {
  await current.run('alter table $table disable trigger "audit_entries_no_rewrite"');
  await current.run(`update $table set "action" = 'forged' where "id" = '${id}'`);
  await current.run('alter table $table enable trigger "audit_entries_no_rewrite"');
}

async function archiveFixture(): Promise<ArchiveFixture> {
  const created = await fixture();

  return sqlArchiveFixture(created.trail, (id) => tampered(created, id), created.run);
}

archiveSpecs('TypeOrmAuditTrail', archiveFixture);
archiveGuardSpecs('TypeOrmAuditTrail', archiveFixture);
