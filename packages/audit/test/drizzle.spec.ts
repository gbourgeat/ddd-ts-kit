import { PGlite } from '@electric-sql/pglite';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { getTableConfig } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDrizzleUnitOfWork } from '@ddd-ts-kit/drizzle/postgres';
import {
  DrizzleAuditTrail,
  auditArchivesTable,
  auditChainsTable,
  auditEntriesTable,
  auditGuardStatements,
} from '../src/drizzle';
import { verifyChain, type AuditTrailOptions } from '../src';
import { archivableAuditTrailContract, auditTrailContract } from '../src/testing';
import { createTableSql } from './support/drizzle-ddl';
import { startPostgres, type TestPostgres } from './support/postgres';
import { archiveGuardSpecs, archiveSpecs, type ArchiveFixture } from './support/archive-specs';
import { sqlArchiveFixture } from './support/archive-fixture';
import { sqlTrailSpecs } from './support/sql-trail-specs';
import { REAL_SERVER, aRecord, type SqlTrailFixture } from './support/sql-trail-fixture';

const runner = { describe, it, expect, beforeEach };

let postgres: TestPostgres;
let pool: pg.Pool;
let otherPool: pg.Pool | undefined;
let db: NodePgDatabase;
let elsewhere: NodePgDatabase;

beforeAll(async () => {
  postgres = await startPostgres();
  const connect = () => new pg.Pool({ connectionString: postgres.url, max: postgres.poolSize });

  pool = connect();
  otherPool = postgres.real ? connect() : undefined;
  db = drizzle(pool);
  elsewhere = otherPool === undefined ? db : drizzle(otherPool);
});

afterAll(async () => {
  await pool.end();
  await otherPool?.end();
  await postgres.stop();
});

/** What a project's migrations hold: the two tables as drizzle-kit would create them, then the guard. */
function migrationOf(schema?: string): string[] {
  return [
    ...createTableSql(auditChainsTable(schema)),
    ...createTableSql(auditEntriesTable(schema)),
    ...createTableSql(auditArchivesTable(schema)),
    ...auditGuardStatements(schema),
  ];
}

let schemas = 0;

async function freshSchema(): Promise<string> {
  schemas += 1;
  const schema = `audit_${schemas}`;

  for (const statement of migrationOf(schema)) {
    await pool.query(statement);
  }

  return schema;
}

async function fixture(options: AuditTrailOptions = {}): Promise<SqlTrailFixture> {
  const schema = await freshSchema();

  const on = (database: NodePgDatabase) => {
    const unitOfWork = createDrizzleUnitOfWork(database);

    return {
      unitOfWork,
      trail: new DrizzleAuditTrail(unitOfWork, { ...options, schema }),
      run: (statement: string) => unitOfWork.executor().execute(inSchema(statement, schema)),
    };
  };

  return { ...on(db), elsewhere: () => on(elsewhere) };
}

function inSchema(statement: string, schema: string): string {
  return statement.replaceAll('$table', `"${schema}"."audit_entries"`).replaceAll('$schema', `"${schema}"`);
}

let current: SqlTrailFixture;

auditTrailContract(runner, {
  name: 'DrizzleAuditTrail in a schema of its own',
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
  name: 'DrizzleAuditTrail in a schema of its own',
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

auditTrailContract(runner, {
  name: 'DrizzleAuditTrail in the public schema',
  createTrail: async () => {
    await pool.query(
      'drop table if exists "audit_entries", "audit_chains", "audit_archives"; drop function if exists "audit_entries_append_only"(); drop function if exists "audit_archives_append_only"()',
    );

    for (const statement of migrationOf()) {
      await pool.query(statement);
    }

    return new DrizzleAuditTrail(createDrizzleUnitOfWork(db));
  },
});

sqlTrailSpecs({ name: 'DrizzleAuditTrail', real: REAL_SERVER, create: fixture });

describe('table definitions', () => {
  it('place the tables in the given schema, or in public', () => {
    expect(getTableConfig(auditEntriesTable('audit'))).toMatchObject({ schema: 'audit', name: 'audit_entries' });
    expect(getTableConfig(auditChainsTable('audit'))).toMatchObject({ schema: 'audit', name: 'audit_chains' });
    expect(getTableConfig(auditEntriesTable()).schema).toBeUndefined();
  });

  it('declare the columns the knex migration helper creates, so that both stores read the same table', async () => {
    const schema = await freshSchema();

    const columnsOf = async (table: string) => {
      const { rows } = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
        'select column_name, data_type, is_nullable from information_schema.columns where table_schema = $1 and table_name = $2 order by column_name',
        [schema, table],
      );

      return rows;
    };

    const fromDrizzle = { entries: await columnsOf('audit_entries'), chains: await columnsOf('audit_chains') };

    const { auditTablesSql } = await import('../src/sql/audit-tables-sql');

    await pool.query(
      `drop table "${schema}"."audit_entries", "${schema}"."audit_chains", "${schema}"."audit_archives"; drop function "${schema}"."audit_entries_append_only"(); drop function "${schema}"."audit_archives_append_only"()`,
    );

    for (const statement of auditTablesSql({ schema })) {
      await pool.query(statement);
    }

    expect({ entries: await columnsOf('audit_entries'), chains: await columnsOf('audit_chains') }).toEqual(fromDrizzle);
    expect(fromDrizzle.entries).toHaveLength(24);
  });
});

describe('DrizzleAuditTrail on the PGlite driver', () => {
  it('reads the rows the way that driver returns them', async () => {
    const client = new PGlite();

    for (const statement of migrationOf('audit')) {
      await client.exec(statement);
    }

    const unitOfWork = createDrizzleUnitOfWork(drizzlePglite(client));
    const trail = new DrizzleAuditTrail(unitOfWork, { schema: 'audit' });

    await trail.record(aRecord('entry-1'));

    await unitOfWork.run(() =>
      trail.record({ ...aRecord('entry-2'), changes: { rows: 2000, email: { masked: 'k1:9f' } } }),
    );

    const { items, total } = await trail.search(
      { chain: 'tenant:acme' },
      { kind: 'offset', offset: 0, limit: 10, sort: [] },
    );

    expect(total).toBe(2);

    expect(items[1]).toMatchObject({
      id: 'entry-2',
      sequence: 2,
      occurredAt: aRecord('x').occurredAt,
      changes: { rows: 2000, email: { masked: 'k1:9f' } },
    });

    expect(await verifyChain(trail, { chain: 'tenant:acme' })).toEqual({ valid: true, checked: 2 });
    await client.close();
  });
});

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

archiveSpecs('DrizzleAuditTrail', archiveFixture);
archiveGuardSpecs('DrizzleAuditTrail', archiveFixture);
