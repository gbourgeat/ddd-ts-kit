import { getTableColumns, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { bigint, boolean, pgSchema, text, timestamp, type PgColumn, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import {
  READ_MODEL_TABLE_SHAPES,
  readModelTablesContract,
  type ReadModelTableShape,
} from '@ddd-ts-kit/testing/contracts';
import { DrizzleReadModelTable, createDrizzleUnitOfWork } from '../src/postgres';
import { rowsOf } from '../src/postgres/read-model/rows-of';
import { createContractDatabase, type ContractDatabase } from './support/read-model/contract-database';

const runner = { describe, it, expect, beforeEach, afterEach };
const schema = pgSchema(READ_MODEL_TABLE_SHAPES.schema);

const STAMPS = {
  lastEventId: 'last_event_id',
  lastEventAt: 'last_event_at',
  lastEventVersion: 'last_event_version',
  deleted: 'deleted',
};

/** The definition a project would write for a table of the contract: text fields, NOT NULL where the shape says the definition is. */
function definitionOf({ table, key, fields, tenant, stamps = STAMPS, required = [] }: ReadModelTableShape) {
  const mapped = [key, ...fields, ...(tenant === undefined ? [] : [tenant])];

  return schema.table(table, {
    ...Object.fromEntries(
      mapped.map((field) => [field, required.includes(field) ? text(field).notNull() : text(field)]),
    ),
    lastEventId: text(stamps.lastEventId).notNull(),
    lastEventAt: timestamp(stamps.lastEventAt, { withTimezone: true, mode: 'string' }).notNull(),
    lastEventVersion: bigint(stamps.lastEventVersion, { mode: 'number' }),
    deleted: boolean(stamps.deleted).notNull().default(false),
  });
}

let database: ContractDatabase;

beforeAll(async () => {
  database = await createContractDatabase([]);
});

afterAll(async () => {
  await database.close();
});

/** A port nothing listens on: a connection there is refused at once. */
const CLOSED = 'postgresql://app:app@127.0.0.1:1/none';

readModelTablesContract(runner, {
  name: 'DrizzleReadModelTable',
  unreachable: (shape) => {
    const pool = new pg.Pool({ connectionString: CLOSED, max: 1 });
    const defined = definitionOf(shape);
    const columns: Readonly<Record<string, PgColumn>> = getTableColumns(defined);
    const column = (field: string): PgColumn => columns[field] ?? defined.deleted;

    return {
      table: new DrizzleReadModelTable<Record<string, string | null>, PgQueryResultHKT>(
        createDrizzleUnitOfWork(drizzle(pool)),
        {
          table: defined,
          key: column(shape.key),
          columns: Object.fromEntries([shape.key, ...shape.fields].map((field) => [field, column(field)])),
        },
      ),
      close: () => pool.end(),
    };
  },
  tenantColumn: true,
  renamedStamps: true,
  definition: true,
  createTables: () => {
    const unitOfWork = createDrizzleUnitOfWork(database.db);
    const scope = new FixedExecutionScope(anExecutionContext().ofTenant('acme').build());

    return {
      table: (shape) => {
        const defined = definitionOf(shape);
        const columns: Readonly<Record<string, PgColumn>> = getTableColumns(defined);
        const column = (field: string): PgColumn => columns[field] ?? defined.deleted;

        return new DrizzleReadModelTable<Record<string, string | null>, PgQueryResultHKT>(unitOfWork, {
          table: defined,
          key: column(shape.key),
          columns: Object.fromEntries([shape.key, ...shape.fields].map((field) => [field, column(field)])),
          ...(shape.tenant === undefined ? {} : { tenant: { scope, column: column(shape.tenant) } }),
        });
      },
      execute: async (statement) => rowsOf(await unitOfWork.executor().execute(sql.raw(statement))),
      transaction: (work) => unitOfWork.run(work),
    };
  },
});
