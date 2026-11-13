import { DefaultNamingStrategy, EntitySchema, type EntitySchemaOptions } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReadModelTableNotReadyError } from '@ddd-ts-kit/kernel';
import { TypeOrmReadModelTable, createTypeOrmUnitOfWork, readModelColumns, type ReadModelStamps } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

interface NoteRow {
  id: string;
  title: string | null;
}

/** A strategy that rewrites every column, the ones an entity names included, and every table. */
class Prefixed extends DefaultNamingStrategy {
  override columnName(property: string, custom: string | undefined): string {
    return `c_${custom ?? property}`;
  }

  override tableName(target: string, custom: string | undefined): string {
    return `t_${custom ?? target}`;
  }
}

const columnsOf = (nullable: boolean): EntitySchemaOptions<NoteRow & ReadModelStamps>['columns'] => ({
  id: { type: 'text', primary: true },
  title: { name: 'title', type: 'text', nullable },
  ...readModelColumns(),
});

const notes = new EntitySchema<NoteRow & ReadModelStamps>({ name: 'notes', columns: columnsOf(true) } as const);
const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-11-12T09:00:00.000Z') };

describe('TypeOrmReadModelTable under a naming strategy that rewrites the names an entity gives', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createDatabase([notes], new Prefixed());
  });

  afterAll(async () => {
    await database.close();
  });

  const table = () =>
    new TypeOrmReadModelTable<NoteRow>(createTypeOrmUnitOfWork(database.dataSource), { entity: notes });

  it('reads the table, its columns and the mark of a deleted row under the names the database holds', async () => {
    expect(await table().tableState()).toEqual({
      table: 't_notes',
      exists: true,
      refusing: [],
      unfit: [],
      row: ['c_title'],
      deleted: 'c_deleted',
      constraint: { state: 'missing', columns: [] },
    });
  });

  it('writes a migration the database takes, and reads the constraint it wrote as held', async () => {
    await database.dataSource.query('alter table "t_notes" alter column "c_title" set not null');

    const refusal: unknown = await table()
      .insert({ key: 'gone', row: undefined, stamp })
      .catch((error: unknown) => error);

    const statements = refusal instanceof ReadModelTableNotReadyError ? refusal.statements : [];

    expect(statements.join('\n')).toContain('check ("c_deleted" or ("c_title" is not null)) not valid;');

    for (const statement of statements) {
      await database.dataSource.query(statement);
    }

    expect((await table().tableState()).constraint).toEqual({ state: 'held', columns: ['c_title'] });
    expect(await table().insert({ key: 'gone', row: undefined, stamp })).toBe(true);
  });

  it('refuses an entity when it is built by the table and the columns of the database, not by its properties', () => {
    const strict = new EntitySchema<NoteRow & ReadModelStamps>({
      name: 'StrictNote',
      columns: columnsOf(false),
    } as const);

    const built = () =>
      new TypeOrmReadModelTable<NoteRow>(createTypeOrmUnitOfWork(database.dataSource), { entity: strict });

    expect(built).toThrow(
      expect.objectContaining({
        state: expect.objectContaining({ table: 't_StrictNote', refusing: ['c_title'], deleted: 'c_deleted' }),
      }),
    );
  });
});
