import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import {
  CONCURRENCY_CONFLICT,
  ConcurrencyError,
  createTypeOrmUnitOfWork,
  optimisticUpdate,
  schemaNameOf,
} from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';
import { Invoice, TypeOrmInvoiceRepository, invoices } from './support/invoices.js';

let database: TestDatabase;
beforeAll(async () => {
  database = await createDatabase([invoices]);
});
afterAll(async () => {
  await database.close();
});

let next = 0;
repositoryContract<Invoice>(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'A TypeORM repository built on manager() and optimisticUpdate',
    createRepository: async () => {
      await database.truncate();
      return new TypeOrmInvoiceRepository(createTypeOrmUnitOfWork(database.dataSource));
    },
    createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
    mutate: (invoice) => invoice.addCharge(50),
    idOf: (invoice) => invoice.id,
    stateOf: (invoice) => invoice.state,
  },
);

describe('optimisticUpdate', () => {
  const aggregate = (version: number) => ({ id: 'inv-1', version });

  it('tells the write which version to expect and which to store, then moves the aggregate on', async () => {
    const invoice = aggregate(3);
    const steps: unknown[] = [];

    await optimisticUpdate(invoice, async (step) => {
      steps.push(step);
      return 1;
    });

    expect(steps).toEqual([{ expected: 3, next: 4 }]);
    expect(invoice.version).toBe(4);
  });

  it('raises a ConcurrencyError and leaves the version alone when no row was written', async () => {
    const invoice = aggregate(3);

    const failing = optimisticUpdate(invoice, async () => 0);

    await expect(failing).rejects.toBeInstanceOf(ConcurrencyError);
    await expect(optimisticUpdate(invoice, async () => 0)).rejects.toMatchObject({
      code: CONCURRENCY_CONFLICT,
      message: 'Aggregate inv-1 was modified concurrently',
    });
    expect(invoice.version).toBe(3);
  });

  it('raises a domain error, so presentation maps it like any other', () => {
    expect(new ConcurrencyError('inv-1')).toBeInstanceOf(DomainError);
    expect(CONCURRENCY_CONFLICT).toBe('CONCURRENCY_CONFLICT');
  });

  it('refuses to create an aggregate that already exists', async () => {
    await database.truncate();
    const repository = new TypeOrmInvoiceRepository(createTypeOrmUnitOfWork(database.dataSource));
    await repository.save(Invoice.draft('inv-1', 100));

    await expect(repository.save(Invoice.draft('inv-1', 999))).rejects.toBeInstanceOf(ConcurrencyError);
    expect((await repository.findById('inv-1'))?.state.amount).toBe(100);
  });
});

describe('schemaNameOf', () => {
  it('gives one schema per context, in snake_case', () => {
    expect(schemaNameOf('billing')).toBe('billing');
    expect(schemaNameOf('order-management')).toBe('order_management');
    expect(database.dataSource.getMetadata(invoices).tablePath).toBe('billing_core.invoices');
  });

  it.each(['Billing', 'billing_core', 'billing core', '-billing', 'billing-', '', '"; drop schema'])(
    'refuses the context name "%s"',
    (name) => {
      expect(() => schemaNameOf(name)).toThrow(TypeError);
    },
  );
});
