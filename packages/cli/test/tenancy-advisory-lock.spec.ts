import { describe, expect, it } from 'vitest';
import { project } from '../src/check/fixtures/project';
import { TENANCY_ADAPTERS } from '../src/check/fixtures/tenancy-adapters';
import { ADVISORY_LOCKS_BY_HAND } from '../src/check/fixtures/tenancy-advisory-lock-fixtures';
import { tenancyConfig } from '../src/check/fixtures/tenancy-config';
import { tempDir, write } from './helpers';
import { reported } from './rules-support';

type Orm = keyof typeof TENANCY_ADAPTERS;

const BY_HAND =
  'An advisory lock is taken by a raw statement: take it with `advisoryLock(context, key, { tenant: scope })` or `tryAdvisoryLock` of the ORM package, which keeps the key of two tenants apart and refuses outside a unit of work.';

function messagesOf(orm: Orm, body: string): string[] {
  const { file, owner } = TENANCY_ADAPTERS[orm];
  const root = tempDir('tenancy-advisory-lock');
  const source = `export class ${owner} {\n  async work(key: string) {\n    ${body}\n  }\n}\n`;

  for (const [path, content] of Object.entries(project({ [file]: source }, tenancyConfig(orm)))) {
    write(root, path, content);
  }

  return reported(root, 'tenancy/scoped-statement').map(({ message }) => message);
}

describe('tenancy/scoped-statement and the lock on a business key', () => {
  it.each(['knex', 'drizzle', 'prisma', 'typeorm'] as const)(
    'names the helper when a %s adapter takes an advisory lock by a raw statement',
    (orm) => {
      expect(messagesOf(orm, ADVISORY_LOCKS_BY_HAND[orm])).toEqual([BY_HAND]);
    },
  );

  it.each(['knex', 'drizzle', 'prisma', 'typeorm'] as const)(
    'reports nothing when a %s adapter takes the lock through the helper',
    (orm) => {
      expect(
        messagesOf(
          orm,
          "await advisoryLock(this.database, key, { tenant: this.scope });\n    await tryAdvisoryLock(this.database, 'closing');",
        ),
      ).toEqual([]);
    },
  );

  it('keeps its own words for raw SQL that takes no lock, the last statement of a file included', () => {
    const { file } = TENANCY_ADAPTERS.knex;
    const root = tempDir('tenancy-advisory-lock');

    const files = project(
      { [file]: "export const all = (db: Db) => db.executor().raw('select * from invoices')" },
      tenancyConfig('knex'),
    );

    for (const [path, content] of Object.entries(files)) {
      write(root, path, content);
    }

    expect(reported(root, 'tenancy/scoped-statement').map(({ message }) => message)).toEqual([
      'Raw SQL reaches the tables with no tenant condition.',
    ]);
  });
});
