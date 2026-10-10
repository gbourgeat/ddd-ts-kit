import { declarationOf } from '@ddd-ts-kit/kernel/declarations';
import { expect, it } from 'vitest';
import { Journal } from './application/ports/journal.port.js';
import { Ledger } from './domain/repositories/ledger.repository.js';
import { EmptyJournal } from './infrastructure/external/empty-journal.adapter.mjs';
import { InMemoryLedger } from './infrastructure/persistence/in-memory-ledger.repository.js';

it('runs a TypeScript source that holds standard decorators', () => {
  const ledger = new InMemoryLedger();

  ledger.record(40);
  ledger.record(2);

  expect(ledger.total()).toBe(42);
  expect(declarationOf(InMemoryLedger)).toMatchObject({ role: 'repository', token: Ledger });
  expect(declarationOf(EmptyJournal)).toMatchObject({ role: 'adapter', token: Journal, kind: 'external' });
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
  expect(failure instanceof Error ? failure.stack : '').toMatch(/in-memory-ledger\.repository\.ts:10:/);
});
