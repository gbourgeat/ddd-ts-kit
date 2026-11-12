import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelTablesContract } from '@ddd-ts-kit/testing/contracts';
import { createPrismaUnitOfWork, prismaReadModelTables } from '../../src';
import { createDatabase, type TestDatabase } from '../support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

readModelTablesContract(runner, {
  name: 'prismaReadModelTables',
  createTables: () => {
    const unitOfWork = createPrismaUnitOfWork(database.prisma);

    return {
      tables: (options) => prismaReadModelTables(unitOfWork, options),
      execute: (statement) => database.prisma.$executeRawUnsafe(statement),
    };
  },
});
