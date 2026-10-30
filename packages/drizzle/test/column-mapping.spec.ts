import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { columnOf } from '../src/postgres/read-model/column-of';
import { people } from './support/personal-data/people-table';

describe('the column of a field of a read model', () => {
  it('is the one of the table for the field, never one a field inherits', () => {
    expect(columnOf(getTableColumns(people), 'personId').name).toBe('person_id');
    expect(() => columnOf(getTableColumns(people), 'seats')).toThrow('The field "seats" is mapped to no column');
    expect(() => columnOf({}, 'constructor')).toThrow('The field "constructor" is mapped to no column');
  });
});
