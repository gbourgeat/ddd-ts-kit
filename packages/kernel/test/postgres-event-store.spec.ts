import { describe, expect, it } from 'vitest';
import { UnreadableEventError, eventStoreTablesSql } from '../src/index.js';
import { isUniqueViolation } from '../src/infrastructure/event-sourcing/postgres/is-unique-violation.js';
import { storedDataFrom } from '../src/infrastructure/event-sourcing/postgres/stored-data-from.js';

describe('the event store on PostgreSQL', () => {
  it('knows a duplicate key whatever wraps the error of the driver', () => {
    const duplicate = { code: '23505' };

    expect(isUniqueViolation(duplicate)).toBe(true);
    expect(isUniqueViolation({ cause: duplicate })).toBe(true);
    expect(isUniqueViolation({ driverError: duplicate })).toBe(true);
    expect(isUniqueViolation({ meta: duplicate })).toBe(true);
    expect(isUniqueViolation({ code: '40001' })).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation({ cause: { cause: { cause: { cause: { cause: duplicate } } } } })).toBe(false);
  });

  it('reads a JSON column the driver answered as text, and refuses what is not a JSON object', () => {
    expect(storedDataFrom('{"grams":3,"tags":["a",null],"box":{"open":false}}', 'data')).toEqual({
      grams: 3,
      tags: ['a', null],
      box: { open: false },
    });

    expect(() => storedDataFrom('[1]', 'The data of e1')).toThrow(UnreadableEventError);
    expect(() => storedDataFrom({ at: new Date(0) }, 'The data of e1')).toThrow('The data of e1 is not a JSON object');
  });

  it('creates its tables in the schema of the context, quoted, each statement safe to run again', () => {
    const statements = eventStoreTablesSql({ schema: 'scheduling' });

    expect(statements[0]).toBe('create schema if not exists "scheduling"');

    expect(
      statements.slice(1).every((statement) => statement.startsWith('create table if not exists "scheduling".')),
    ).toBe(true);

    expect(eventStoreTablesSql()).toHaveLength(5);
  });
});
