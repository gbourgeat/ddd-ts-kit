import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import { createDrizzleUnitOfWork } from '../src/postgres';
import { createDatabase } from './support/database';
import { ada, scopeOf } from './support/scopes';
import { Invoice } from './support/billing-core/domain/invoice';
import { DrizzleInvoiceRepository } from './support/billing-core/infrastructure/persistence/drizzle-invoice.repository';
import { invoices } from './support/billing-core/infrastructure/persistence/invoices';

let database: Awaited<ReturnType<typeof createDatabase>>;

beforeAll(async () => {
  database = await createDatabase([invoices]);
  // The amount kept unique stands for a business column the storage enforces (an email, a number).
  await database.client.exec('create unique index invoices_amount_unique on billing_core.invoices (amount)');
});

afterAll(async () => {
  await database.client.close();
});

let next = 0;

repositoryContract<Invoice>(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'A Drizzle repository over a table with a unique column',
    createRepository: async () => {
      await database.truncate();

      return new DrizzleInvoiceRepository(
        createDrizzleUnitOfWork(database.db),
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
