import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import { READ_MODEL_TABLE_SHAPES, readModelTablesContract } from '@ddd-ts-kit/testing/contracts';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import { KnexReadModelTable, createKnexUnitOfWork } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(() => Promise.resolve(), []);
});

afterAll(async () => {
  await database.close();
});

readModelTablesContract(runner, {
  name: 'KnexReadModelTable',
  createTables: () => {
    const unitOfWork = createKnexUnitOfWork(database.knex);
    const scope = new FixedExecutionScope(anExecutionContext().ofTenant('acme').build());

    return {
      table: ({ table, key, fields, tenant }) =>
        new KnexReadModelTable<Record<string, string | null>>(unitOfWork, {
          schema: READ_MODEL_TABLE_SHAPES.schema,
          table,
          keyColumn: key,
          columns: Object.fromEntries([key, ...fields].map((field) => [field, field])),
          ...(tenant === undefined ? {} : { tenant: scope }),
        }),
      execute: async (statement) => {
        const answered: unknown = await unitOfWork.executor().raw(statement);
        const rows: unknown = typeof answered === 'object' && answered !== null && 'rows' in answered ? answered.rows : [];

        return Array.isArray(rows) ? rows : [];
      },
      transaction: (work) => unitOfWork.run(work),
    };
  },
});
