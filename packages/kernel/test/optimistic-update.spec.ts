import { describe, expect, it } from 'vitest';
import { ConcurrencyError, optimisticUpdate, schemaNameOf, type VersionStep } from '../src/index.js';

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
