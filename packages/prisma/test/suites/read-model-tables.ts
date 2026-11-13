import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import { READ_MODEL_TABLE_SHAPES, readModelTablesContract } from '@ddd-ts-kit/testing/contracts';
import { PrismaReadModelTable, createPrismaUnitOfWork } from '../../src';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/client/client';
import { createDatabase, type TestDatabase } from '../support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

/** A port nothing listens on: a connection there is refused at once. */
const CLOSED = 'postgresql://app:app@127.0.0.1:1/none';

readModelTablesContract(runner, {
  name: 'PrismaReadModelTable',
  unreachable: ({ table, key, fields }) => {
    const closed = new PrismaClient({ adapter: new PrismaPg({ connectionString: CLOSED }) });

    return {
      table: new PrismaReadModelTable<Record<string, string | null>, Prisma.TransactionClient>(
        createPrismaUnitOfWork(closed),
        {
          delegate: (client) => client.criteriaContractRow,
          schema: READ_MODEL_TABLE_SHAPES.schema,
          table,
          key,
          columns: Object.fromEntries([key, ...fields].map((field) => [field, field])),
        },
      ),
      close: () => closed.$disconnect(),
    };
  },
  tenantColumn: true,
  createTables: () => {
    const unitOfWork = createPrismaUnitOfWork(database.prisma);
    const scope = new FixedExecutionScope(anExecutionContext().ofTenant('acme').build());

    return {
      table: ({ table, key, fields, tenant }) =>
        new PrismaReadModelTable<Record<string, string | null>, Prisma.TransactionClient>(unitOfWork, {
          // The tables of the contract have no model: it writes traces and reads states, which go by the table.
          delegate: (client) => client.criteriaContractRow,
          schema: READ_MODEL_TABLE_SHAPES.schema,
          table,
          key,
          columns: Object.fromEntries(
            [key, ...fields, ...(tenant === undefined ? [] : [tenant])].map((field) => [field, field]),
          ),
          ...(tenant === undefined ? {} : { tenant: { scope, field: tenant } }),
        }),
      execute: async (statement) => {
        const rows: unknown = await unitOfWork.client().$queryRawUnsafe(statement);

        return Array.isArray(rows) ? rows : [];
      },
      transaction: (work) => unitOfWork.run(work),
    };
  },
});
