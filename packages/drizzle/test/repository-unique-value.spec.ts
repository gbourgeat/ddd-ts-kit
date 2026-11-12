import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import { createDrizzleUnitOfWork } from '../src/postgres';
import type { Database } from './support/platform/database/database';
import { ada, scopeOf } from './support/scopes';
import { Invoice } from './support/billing-core/domain/invoice';
import { DrizzleInvoiceRepository } from './support/billing-core/infrastructure/persistence/drizzle-invoice.repository';
import { invoices } from './support/billing-core/infrastructure/persistence/invoices';
import { createStoreDatabase, type StoreDatabase } from './support/store-database';

// On the server of `DDD_TS_KIT_TEST_DATABASE_URL` when it is set: first saves made at once race over real connections there.
let database: StoreDatabase;

beforeAll(async () => {
  database = await createStoreDatabase([invoices]);
  // The amount kept unique stands for a business column the storage enforces (an email, a number).
  await database.db.execute(sql.raw('create unique index invoices_amount_unique on billing_core.invoices (amount)'));
});

afterAll(async () => {
  await database.close();
});

let next = 0;

repositoryContract<Invoice>(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'A Drizzle repository over a table with a unique column',
    createRepository: async () => {
      await database.truncate();

      return new DrizzleInvoiceRepository(
        // The repository names the PGlite database of the project; on a server the same statements go through node-postgres.
        createDrizzleUnitOfWork(database.db) as unknown as Database,
        scopeOf(ada),
        new FixedClock(new Date('2026-03-01T10:00:00.000Z')),
      );
    },
    createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, next * 100),
    createAggregateTaking: (holder) => Invoice.draft(`inv-${(next += 1)}`, holder.state.amount),
    createAggregateAgain: (first) => Invoice.draft(first.id, first.state.amount),
    mutate: (invoice) => invoice.addCharge(50),
    idOf: (invoice) => invoice.id,
    stateOf: (invoice) => invoice.state,
  },
);
