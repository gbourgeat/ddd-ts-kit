import { describe, expect, it } from 'vitest';
import { RowMapper } from '../src/read-model/row.mapper';

describe('the row mapper of a read model', () => {
  it('names the column of a field from the mapping of the adapter, never one a field inherits', () => {
    const mapper = new RowMapper<{ readonly startsAt: Date }>({ startsAt: 'starts_at' });

    expect(mapper.columnOf('startsAt')).toBe('starts_at');
    expect(() => mapper.columnOf('seats')).toThrow('The field "seats" is mapped to no column');
    expect(() => mapper.columnOf('constructor')).toThrow('The field "constructor" is mapped to no column');
  });
});
