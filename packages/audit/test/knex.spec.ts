import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { createKnexUnitOfWork } from '@ddd-ts-kit/knex';
import { auditArchiveUpgradeStatements } from '../src/drizzle';
import { KnexAuditTrail, addAuditArchives, createAuditTables, dropAuditTables } from '../src/knex';
import type { AuditTrailOptions } from '../src';
import { archivableAuditTrailContract, auditTrailContract } from '../src/testing';
import { startPostgres, type TestPostgres } from './support/postgres';
import { archiveGuardSpecs, archiveSpecs, type ArchiveFixture } from './support/archive-specs';
import { sqlArchiveFixture } from './support/archive-fixture';
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
  cut: async (chain, fromSequence) => {
    await current.run('alter table $table disable trigger "audit_entries_no_rewrite"');
    await current.run(`delete from $table where "chain" = '${chain}' and "sequence" >= ${fromSequence}`);
    await current.run('alter table $table enable trigger "audit_entries_no_rewrite"');
  },
});

archivableAuditTrailContract(runner, {
  name: 'KnexAuditTrail in a schema of its own',
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
  name: 'KnexAuditTrail in the default schema',
  createTrail: async () => {
    await dropAuditTables(db);
    await createAuditTables(db);

    return new KnexAuditTrail(createKnexUnitOfWork(db));
  },
});

sqlTrailSpecs({ name: 'KnexAuditTrail', real: REAL_SERVER, create: fixture });

describe('createAuditTables', () => {
  it('creates the three tables, the indexes of the reader and the guard, in the given schema', async () => {
    const schema = await freshSchema();

    const { rows: indexes } = await db.raw<{ rows: { indexname: string }[] }>(
      'select indexname from pg_indexes where schemaname = ? order by indexname',
      [schema],
    );

    const { rows: triggers } = await db.raw<{ rows: { tgname: string }[] }>(
      `select tgname from pg_trigger where tgrelid = '"${schema}"."audit_entries"'::regclass and not tgisinternal order by tgname`,
    );

    expect(indexes.map((row) => row.indexname)).toEqual([
      'audit_archives_pkey',
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
    expect(await db.schema.withSchema(schema).hasTable('audit_archives')).toBe(false);

    const { rows } = await db.raw<{ rows: unknown[] }>(
      `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ? and p.proname in ('audit_entries_append_only', 'audit_archives_append_only')`,
      [schema],
    );

    expect(rows).toEqual([]);
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

archiveSpecs('KnexAuditTrail', archiveFixture);
archiveGuardSpecs('KnexAuditTrail', archiveFixture);

/** A trail as `createAuditTables` wrote it before the archives: no archives table, a guard that refuses every delete. */
async function trailBeforeTheArchives(): Promise<{ readonly schema: string; readonly trail: KnexAuditTrail }> {
  const schema = await freshSchema();

  await db.raw(`drop table "${schema}"."audit_archives" cascade`);

  await db.raw(
    `create or replace function "${schema}"."audit_entries_append_only"() returns trigger language plpgsql as $$ begin raise exception 'audit entries are append-only'; end $$`,
  );

  const trail = new KnexAuditTrail(createKnexUnitOfWork(db), { schema });

  await trail.record({ ...aRecord('entry-1'), occurredAt: new Date('2026-01-10T00:00:00.000Z') });

  return { schema, trail };
}

const archiving = { files: new InMemoryFileStorage(), clock: new FixedClock(new Date('2026-04-01T00:00:00.000Z')) };
const MARCH = new Date('2026-03-01T00:00:00.000Z');

describe('a trail created before the archives', () => {
  it('cannot archive until it is upgraded', async () => {
    const { trail } = await trailBeforeTheArchives();

    await expect(trail.archiveBefore(MARCH, archiving)).rejects.toThrow();
  });

  it('archives once addAuditArchives ran in a migration', async () => {
    const { schema, trail } = await trailBeforeTheArchives();

    await addAuditArchives(db, { schema });

    expect((await trail.archiveBefore(MARCH, archiving)).archives).toMatchObject([{ fromSequence: 1, toSequence: 1 }]);
  });

  it('archives once the statements of auditArchiveUpgradeStatements ran, as Drizzle, Prisma and TypeORM migrations run them', async () => {
    const { schema, trail } = await trailBeforeTheArchives();

    for (const statement of auditArchiveUpgradeStatements(schema)) {
      await db.raw(statement);
    }

    expect((await trail.archiveBefore(MARCH, archiving)).archives).toHaveLength(1);
    expect(auditArchiveUpgradeStatements()[0]).toContain('create table if not exists "audit_archives"');
  });
});
