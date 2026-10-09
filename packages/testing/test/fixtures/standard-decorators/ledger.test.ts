import { declarationOf } from '@ddd-ts-kit/kernel/declarations';
import { expect, it } from 'vitest';
import { EmptyJournal, JOURNAL } from './journal.mjs';
import { InMemoryLedger, LEDGER } from './ledger.js';

it('runs a TypeScript source that holds standard decorators', () => {
  const ledger = new InMemoryLedger();

  ledger.record(40);
  ledger.record(2);

  expect(ledger.total()).toBe(42);
  expect(declarationOf(InMemoryLedger)).toMatchObject({ role: 'repository', token: LEDGER });
  expect(declarationOf(EmptyJournal)).toMatchObject({ role: 'adapter', token: JOURNAL, kind: 'external' });
});

it('reports a failure at the line of the source, not of what was compiled', () => {
  const failure = (() => {
    try {
      return new InMemoryLedger().record(Number.NaN);
    } catch (error) {
      return error;
    }
  })();

  expect(failure).toBeInstanceOf(RangeError);
  expect(failure instanceof Error ? failure.stack : '').toMatch(/ledger\.ts:15:/);
});
