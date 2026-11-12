import { describe, expect, it } from 'vitest';
import { DataSource, type DataSourceOptions, EntitySchema } from 'typeorm';
import { UniqueViolationError } from '@ddd-ts-kit/kernel';
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

/** What the query runner of the spec answers: the rows an insert wrote, and how many rows hold the key. */
interface Answers {
  readonly written: number;
  readonly holders: number;
}

/** The statements the helper sends on `options`, and what it answers, through a query runner that answers `answers`. */
async function sentOn(
  options: DataSourceOptions,
  answers: Answers = { written: 1, holders: 0 },
): Promise<{ readonly sent: string; readonly outcome: unknown }> {
  const dataSource = await new OfflineDataSource({ ...options, entities: [members] }).described();
  const sent: string[] = [];

  const runner = Object.assign(dataSource.createQueryRunner(), {
    query: async (statement: string) => {
      sent.push(statement);

      return /^SELECT/i.test(statement)
        ? { records: [{ cnt: String(answers.holders) }] }
        : { affected: answers.written };
    },
  });

  const outcome = await insertIgnoringConflict(dataSource.createEntityManager(runner), members, {
    id: 'm-1',
    email: 'a@b',
  }).catch((error: unknown) => error);

  return { sent: sent.join('\n'), outcome };
}

describe('insertIgnoringConflict', () => {
  it('writes a row no unique value refuses in one statement that names no target (PostgreSQL)', async () => {
    const { sent, outcome } = await sentOn({ type: 'postgres' });

    expect(outcome).toBe(true);
    expect(sent).toMatch(/ON CONFLICT DO NOTHING$/);
  });

  it.each([
    ['PostgreSQL', { type: 'postgres' }, 'ON CONFLICT DO NOTHING'],
    ['SQLite', { type: 'better-sqlite3', database: ':memory:' }, 'ON CONFLICT DO NOTHING'],
  ] as const)(
    'names the primary key alone in a second statement when the first wrote nothing (%s)',
    async (_, options, skipping) => {
      const { sent, outcome } = await sentOn(options, { written: 0, holders: 0 });
      const [first, second, ...others] = sent.split('\n');

      expect(outcome).toBe(false);
      expect(first).toContain(skipping);
      expect(second).toContain('ON CONFLICT ( "id" ) DO NOTHING');
      expect(others).toEqual([]);
    },
  );

  it('falls back to INSERT IGNORE on MySQL, which has no conflict target', async () => {
    const { sent, outcome } = await sentOn({ type: 'mysql', database: 'kit' });

    expect(outcome).toBe(true);
    expect(sent).toMatch(/^INSERT\s+IGNORE/);
    expect(sent).not.toContain('ON CONFLICT');
  });

  it('reads an INSERT IGNORE that wrote nothing as a taken key when a row holds it, on MySQL', async () => {
    const { sent, outcome } = await sentOn({ type: 'mysql', database: 'kit' }, { written: 0, holders: 1 });

    expect(outcome).toBe(false);
    expect(sent).toMatch(/SELECT COUNT/);
  });

  it('raises a UniqueViolationError when INSERT IGNORE skipped a row whose key no row holds, on MySQL', async () => {
    const { outcome } = await sentOn({ type: 'mysql', database: 'kit' }, { written: 0, holders: 0 });

    expect(outcome).toBeInstanceOf(UniqueViolationError);
    expect(outcome).toMatchObject({ code: 'CONFLICT' });
  });
});
