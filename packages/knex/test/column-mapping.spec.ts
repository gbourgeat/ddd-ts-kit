import { describe, expect, it } from 'vitest';
import { columnOf } from '../src/read-model/column-of';

describe('the column of a field of a read model', () => {
  it('is the one the mapping of the adapter gives, never one a field inherits', () => {
    expect(columnOf({ startsAt: 'starts_at' }, 'startsAt')).toBe('starts_at');
    expect(() => columnOf({ startsAt: 'starts_at' }, 'seats')).toThrow('The field "seats" is mapped to no column');
    expect(() => columnOf({}, 'constructor')).toThrow('The field "constructor" is mapped to no column');
  });
});
