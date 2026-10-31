import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import { createKnexUnitOfWork } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import { Invoice } from './support/billing-core/domain/invoice';
import { BILLING } from './support/billing-core/infrastructure/persistence/billing-schema';
import { createInvoicesTable } from './support/billing-core/infrastructure/persistence/create-invoices-table';
import { KnexInvoiceRepository } from './support/billing-core/infrastructure/persistence/knex-invoice.repository';
import { ada, scopeOf } from './support/scopes';

let database: TestDatabase;

/** The amount kept unique stands for a business column the storage enforces (an email, a number). */
async function createInvoicesWithUniqueAmounts(knex: Parameters<typeof createInvoicesTable>[0]): Promise<void> {
  await createInvoicesTable(knex);
  await knex.raw(`create unique index invoices_amount_unique on ${BILLING}.invoices (amount)`);
}

beforeAll(async () => {
  database = await createDatabase(createInvoicesWithUniqueAmounts, [`${BILLING}.invoices`]);
});

afterAll(async () => {
  await database.close();
});

let next = 0;

repositoryContract<Invoice>(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'A knex repository over a table with a unique column',
    createRepository: async () => {
      await database.truncate();

      return new KnexInvoiceRepository(
        createKnexUnitOfWork(database.knex),
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
