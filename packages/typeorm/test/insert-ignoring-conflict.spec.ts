import { describe, expect, it } from 'vitest';
import { DataSource, type DataSourceOptions, EntitySchema } from 'typeorm';
import { insertIgnoringConflict } from '../src';

interface MemberRow {
  id: string;
  email: string;
}

const members = new EntitySchema<MemberRow>({
  name: 'Member',
  tableName: 'members',
  columns: { id: { type: 'varchar', primary: true }, email: { type: 'varchar', unique: true } },
});

/** A data source that builds its metadata without reaching a server, so that the statement can be read. */
class OfflineDataSource extends DataSource {
  async described(): Promise<this> {
    await this.buildMetadatas();

    return this;
  }
}

/** The statement the helper sends on `options`, through a query runner that answers one row written. */
async function statementOn(options: DataSourceOptions): Promise<string> {
  const dataSource = await new OfflineDataSource({ ...options, entities: [members] }).described();
  const sent: string[] = [];

  const runner = Object.assign(dataSource.createQueryRunner(), {
    query: async (statement: string) => {
      sent.push(statement);

      return { affected: 1 };
    },
  });

  expect(
    await insertIgnoringConflict(dataSource.createEntityManager(runner), members, { id: 'm-1', email: 'a@b' }),
  ).toBe(true);

  return sent.join('\n');
}

describe('insertIgnoringConflict', () => {
  it('ignores a conflict on the primary key alone where the database names a target (SQLite)', async () => {
    const statement = await statementOn({ type: 'better-sqlite3', database: ':memory:' });

    expect(statement).toContain('ON CONFLICT ( "id" ) DO NOTHING');
  });

  it('falls back to INSERT IGNORE on MySQL, which has no conflict target', async () => {
    const statement = await statementOn({ type: 'mysql', database: 'kit' });

    expect(statement).toMatch(/^INSERT\s+IGNORE/);
    expect(statement).not.toContain('ON CONFLICT');
  });
});
