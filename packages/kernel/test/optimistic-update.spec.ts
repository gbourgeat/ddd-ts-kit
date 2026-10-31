import { describe, expect, it } from 'vitest';
import {
  ConcurrencyError,
  ConflictError,
  optimisticUpdate,
  schemaNameOf,
  UniqueViolationError,
  type VersionStep,
} from '../src';

describe('optimisticUpdate', () => {
  it('asks for an insert at version 0 and gives the aggregate version 1', async () => {
    const aggregate = { id: 'invoice-1', version: 0 };
    const steps: VersionStep[] = [];

    await optimisticUpdate(aggregate, async (step) => {
      steps.push(step);

      return 1;
    });

    expect(steps).toEqual([{ expected: 0, next: 1 }]);
    expect(aggregate.version).toBe(1);
  });

  it('expects the current version and writes the following one', async () => {
    const aggregate = { id: 42, version: 7 };
    const steps: VersionStep[] = [];

    await optimisticUpdate(aggregate, async (step) => {
      steps.push(step);

      return 1;
    });

    expect(steps).toEqual([{ expected: 7, next: 8 }]);
    expect(aggregate.version).toBe(8);
  });

  it('can save the same aggregate again after a success', async () => {
    const aggregate = { id: 'invoice-1', version: 0 };
    const steps: VersionStep[] = [];

    const write = async (step: VersionStep): Promise<number> => {
      steps.push(step);

      return 1;
    };

    await optimisticUpdate(aggregate, write);
    await optimisticUpdate(aggregate, write);

    expect(steps).toEqual([
      { expected: 0, next: 1 },
      { expected: 1, next: 2 },
    ]);
  });

  it('raises a ConcurrencyError and keeps the version when no row was written', async () => {
    const aggregate = { id: 'invoice-1', version: 3 };

    const saving = optimisticUpdate(aggregate, async () => 0);

    await expect(saving).rejects.toBeInstanceOf(ConcurrencyError);
    expect(aggregate.version).toBe(3);
  });

  it('raises a ConcurrencyError when more than one row was written', async () => {
    const aggregate = { id: 'invoice-1', version: 3 };

    await expect(optimisticUpdate(aggregate, async () => 2)).rejects.toBeInstanceOf(ConcurrencyError);
    expect(aggregate.version).toBe(3);
  });

  it('lets the failure of the write through and keeps the version', async () => {
    const aggregate = { id: 'invoice-1', version: 3 };
    const failure = new TypeError('connection lost');

    const saving = optimisticUpdate(aggregate, async () => {
      throw failure;
    });

    await expect(saving).rejects.toBe(failure);
    expect(aggregate.version).toBe(3);
  });

  for (const [what, violation] of [
    ['of PostgreSQL (knex)', { code: '23505' }],
    ['of PostgreSQL wrapped by drizzle', { cause: { code: '23505' } }],
    ['of PostgreSQL wrapped by TypeORM', { driverError: { code: '23505' } }],
    ['of Prisma', { code: 'P2002' }],
    ['of MySQL', { code: 'ER_DUP_ENTRY', sqlState: '23000' }],
    ['of SQLite', { code: 'SQLITE_CONSTRAINT_UNIQUE' }],
    ['on the key, of SQLite', { code: 'SQLITE_CONSTRAINT_PRIMARYKEY' }],
    [
      'raw, of libsql',
      { code: 'SQLITE_CONSTRAINT', message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: members.email' },
    ],
    [
      'raw, of libsql wrapped by drizzle',
      { cause: { code: 'SQLITE_CONSTRAINT', message: 'SQLITE_CONSTRAINT: PRIMARY KEY constraint failed: members.id' } },
    ],
  ] as const) {
    it(`raises a UniqueViolationError, a conflict and not a lost update, for a unique value refused ${what}`, async () => {
      const aggregate = { id: 'member-2', version: 0 };

      const failure = await optimisticUpdate(aggregate, () => Promise.reject(violation)).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(UniqueViolationError);
      expect(failure).toBeInstanceOf(ConflictError);
      expect(failure).not.toBeInstanceOf(ConcurrencyError);
      expect(failure).toMatchObject({ code: 'CONFLICT', cause: violation });
      expect(String(failure)).not.toContain('23505');
      expect(aggregate.version).toBe(0);
    });
  }

  it('lets another raw constraint of SQLite through as it is: a NOT NULL is no unique violation', async () => {
    const aggregate = { id: 'member-2', version: 0 };

    const notNull = {
      code: 'SQLITE_CONSTRAINT',
      message: 'SQLITE_CONSTRAINT: NOT NULL constraint failed: members.email',
    };

    await expect(optimisticUpdate(aggregate, () => Promise.reject(notNull))).rejects.toBe(notNull);
  });

  it('lets a refusal through as it is, whatever its cause', async () => {
    const aggregate = { id: 'member-2', version: 1 };
    const refusal = new ConflictError('Email taken', { cause: { code: '23505' } });

    await expect(optimisticUpdate(aggregate, () => Promise.reject(refusal))).rejects.toBe(refusal);
  });
});

describe('schemaNameOf', () => {
  it('turns a kebab-case context name into a snake_case schema name', () => {
    expect(schemaNameOf('order-management')).toBe('order_management');
    expect(schemaNameOf('billing')).toBe('billing');
    expect(schemaNameOf('billing-core-2')).toBe('billing_core_2');
  });

  it.each(['', 'Billing', 'billing_core', 'billing--core', '-billing', 'billing-', '2billing', 'billing core'])(
    'refuses %j, which is not kebab-case',
    (name) => {
      expect(() => schemaNameOf(name)).toThrow(TypeError);
    },
  );
});
