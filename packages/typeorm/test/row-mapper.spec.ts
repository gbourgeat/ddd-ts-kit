import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RowMapper } from '../src/read-model/row.mapper';
import { createDatabase, type TestDatabase } from './support/database';
import { people } from './support/personal-data/people-entity';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([people]);
});

afterAll(async () => {
  await database.close();
});

describe('the row mapper of a read model', () => {
  it('names the column of a property of the entity, and refuses a property the entity does not have', () => {
    const { driver } = database.dataSource;
    const mapper = new RowMapper(driver, database.dataSource.getMetadata(people).columns);

    expect(mapper.columnOf('personId')).toBe('person_id');
    expect(() => mapper.columnOf('nickname')).toThrow('The entity of the read model has no property "nickname"');
  });
});
