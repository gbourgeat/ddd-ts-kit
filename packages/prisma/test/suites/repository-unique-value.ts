import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import { createPrismaUnitOfWork } from '../../src';
import { createDatabase, type TestDatabase } from '../support/database';
import { Invoice } from '../support/billing-core/domain/invoice';
import { PrismaInvoiceRepository } from '../support/billing-core/infrastructure/persistence/prisma-invoice.repository';
import { ada, scopeOf } from '../support/scopes';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();

  // The amount kept unique stands for a business column the storage enforces (an email, a number).
  await database.prisma.$executeRawUnsafe(
    'create unique index invoices_amount_unique on billing_core.invoices (amount)',
  );
});

afterAll(async () => {
  await database.close();
});

let next = 0;

repositoryContract<Invoice>(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'A Prisma repository over a table with a unique column',
    createRepository: async () => {
      await database.truncate();

      return new PrismaInvoiceRepository(
        createPrismaUnitOfWork(database.prisma),
        scopeOf(ada),
        new FixedClock(new Date('2026-03-01T10:00:00.000Z')),
      );
    },
    createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, next * 100),
    createAggregateTaking: (holder) => Invoice.draft(`inv-${(next += 1)}`, holder.state.amount),
    mutate: (invoice) => invoice.addCharge(50),
    idOf: (invoice) => invoice.id,
    stateOf: (invoice) => invoice.state,
  },
);
