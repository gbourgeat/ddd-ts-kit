import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Clock, DomainError, ExecutionScope, FixedClock } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import {
  CONCURRENCY_CONFLICT,
  ConcurrencyError,
  TypeOrmContext,
  createTypeOrmUnitOfWork,
  optimisticUpdate,
  schemaNameOf,
} from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import { Invoice } from './support/billing-core/domain/invoice';
import { InvoiceRepository } from './support/billing-core/domain/repositories/invoice.repository';
import { invoices } from './support/billing-core/infrastructure/persistence/invoices';
import { TypeOrmInvoiceRepository } from './support/billing-core/infrastructure/persistence/typeorm-invoice.repository';
import { ada, scopeOf } from './support/scopes';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([invoices]);
});

afterAll(async () => {
  await database.close();
});

const repository = () =>
  new TypeOrmInvoiceRepository(
    createTypeOrmUnitOfWork(database.dataSource),
    scopeOf(ada),
    new FixedClock(new Date('2026-03-01T10:00:00.000Z')),
  );

let next = 0;

repositoryContract<Invoice>(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'A TypeORM repository built on manager() and optimisticUpdate',
    createRepository: async () => {
      await database.truncate();

      return repository();
    },
    createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
    mutate: (invoice) => invoice.addCharge(50),
    idOf: (invoice) => invoice.id,
    stateOf: (invoice) => invoice.state,
  },
);

describe('a repository declared with @Repository', () => {
  it('names its port, then the ports of its constructor in order', () => {
    const declare = Repository(InvoiceRepository, [TypeOrmContext, ExecutionScope, Clock]);

    expect(() => declare(TypeOrmInvoiceRepository)).not.toThrow();
  });
});

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
    const subject = repository();

    await subject.save(Invoice.draft('inv-1', 100));

    await expect(subject.save(Invoice.draft('inv-1', 999))).rejects.toBeInstanceOf(ConcurrencyError);
    expect((await subject.findById('inv-1'))?.state.amount).toBe(100);
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
