import { describe, expect, it } from 'vitest';
import {
  CONCURRENCY_CONFLICT,
  ConcurrencyError,
  InMemoryUnitOfWork,
  NotFoundError,
  TransactionConflictError,
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
