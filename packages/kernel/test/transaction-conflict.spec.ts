import { describe, expect, it } from 'vitest';
import {
  CONCURRENCY_CONFLICT,
  ConcurrencyError,
  InMemoryUnitOfWork,
  NotFoundError,
  SERVICE_UNAVAILABLE,
  TransactionConflictError,
  TransactionTimeoutError,
} from '../src';

/** What a unit of work rejects with when its work throws `error`. */
async function rejectionOf(error: unknown): Promise<unknown> {
  return new InMemoryUnitOfWork()
    .run(() => Promise.reject(error))
    .then(
      () => undefined,
      (rejection: unknown) => rejection,
    );
}

describe('a transaction the database gave up for a concurrent one', () => {
  for (const [what, error] of [
    ['a deadlock of PostgreSQL (knex)', { code: '40P01' }],
    ['a serialization failure of PostgreSQL wrapped by drizzle', { cause: { code: '40001' } }],
    ['a deadlock wrapped by TypeORM', { driverError: { code: '40P01' } }],
    ['the write conflict or deadlock of Prisma', { code: 'P2034' }],
    ['a deadlock of MySQL', { code: 'ER_LOCK_DEADLOCK', sqlState: '40001' }],
  ] as const) {
    it(`rejects the unit of work as a conflict to run again: ${what}`, async () => {
      const rejection = await rejectionOf(error);

      expect(rejection).toBeInstanceOf(TransactionConflictError);
      expect(rejection).toBeInstanceOf(ConcurrencyError);
      expect(rejection).toMatchObject({ code: CONCURRENCY_CONFLICT, cause: error });
    });
  }

  it('translates once, at the outermost unit of work, what a nested one let through', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const deadlock = { code: '40P01' };
    let seenInside: unknown;

    const rejection = await unitOfWork
      .run(async () => {
        await unitOfWork
          .run(() => Promise.reject(deadlock))
          .catch((error: unknown) => {
            seenInside = error;
            throw error;
          });
      })
      .catch((error: unknown) => error);

    expect(seenInside).toBe(deadlock);
    expect(rejection).toMatchObject({ cause: deadlock });
  });

  it('lets any other failure through as it is, a refusal whose cause is a conflict included', async () => {
    const constraint = { code: '23505' };
    const refusal = new NotFoundError('Appointment apt-1 was not found', { cause: { code: '40P01' } });

    expect(await rejectionOf(constraint)).toBe(constraint);
    expect(await rejectionOf(refusal)).toBe(refusal);
  });
});

describe('a transaction that waited or ran past the time its ORM allows', () => {
  for (const [what, error] of [
    ['a transaction Prisma could not start within maxWait, or expired after timeout', { code: 'P2028' }],
    ['no connection from the pool of Prisma in time', { code: 'P2024' }],
    [
      'no connection from the pool of Knex in time',
      Object.assign(new Error('pool is full'), { name: 'KnexTimeoutError' }),
    ],
  ] as const) {
    it(`rejects the unit of work as unavailable, to try again later: ${what}`, async () => {
      const rejection = await rejectionOf(error);

      expect(rejection).toBeInstanceOf(TransactionTimeoutError);
      expect(rejection).not.toBeInstanceOf(ConcurrencyError);
      expect(rejection).toMatchObject({ code: SERVICE_UNAVAILABLE, cause: error });
    });
  }

  it('lets a refusal and any other timeout through as they are', async () => {
    const refusal = new NotFoundError('Appointment apt-1 was not found', { cause: { code: 'P2028' } });
    const other = Object.assign(new Error('socket timeout'), { name: 'TimeoutError' });

    expect(await rejectionOf(refusal)).toBe(refusal);
    expect(await rejectionOf(other)).toBe(other);
  });
});
