import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ERASED_PERSONAL_DATA,
  FixedExecutionScope,
  InMemoryFileStorage,
  NoCurrentTenantError,
  NotADataSubjectIdError,
  NotNullablePersonalColumnError,
  executionContext,
  personalFields,
  systemActor,
  type ErasureMode,
  type ExecutionContext,
  type TenantElevation,
} from '@ddd-ts-kit/kernel';
import { personalDataErasureContract } from '@ddd-ts-kit/testing/contracts';
import { KnexPersonalDataErasure, createKnexUnitOfWork, type TenantTableTarget } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import {
  PEOPLE,
  PEOPLE_PATH,
  PEOPLE_STRICT,
  PEOPLE_STRICT_PATH,
  PRIVACY,
  aPersonRow,
  createPeopleTable,
  type PersonRow,
} from './support/personal-data/people-table';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(createPeopleTable, [PEOPLE_PATH, PEOPLE_STRICT_PATH]);
});

afterAll(async () => {
  await database.close();
});

function workIn(tenantId: string | undefined, elevation?: TenantElevation): ExecutionContext {
  return executionContext({
    correlationId: 'erasure-spec',
    actor: systemActor('erasure'),
    origin: 'cli',
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(elevation === undefined ? {} : { elevation }),
  });
}

function declarationOf(erasure: ErasureMode) {
  return personalFields<PersonRow, TenantTableTarget>(PEOPLE, {
    subject: 'person_id',
    fields: ['display_name', 'email', 'age'],
    files: ['avatar_key'],
    erasure,
  });
}

function erasureOf(erasure: ErasureMode, context: ExecutionContext, files = new InMemoryFileStorage()) {
  return new KnexPersonalDataErasure(createKnexUnitOfWork(database.knex), {
    name: 'identity.people',
    declarations: [declarationOf(erasure)],
    tenant: new FixedExecutionScope(context),
    files,
  });
}

const insert = async (rows: readonly PersonRow[]): Promise<void> => {
  await database.knex
    .withSchema(PRIVACY)
    .insert([...rows])
    .into('people');
};

const rowsOf = (subject: string, tenant = 'acme'): Promise<PersonRow[]> =>
  database.knex
    .withSchema(PRIVACY)
    .from<PersonRow>('people')
    .where({ person_id: subject, tenant_id: tenant })
    .orderBy('id');

for (const erasure of ['row', 'pseudonymise'] as const) {
  personalDataErasureContract<PersonRow>(runner, {
    name: `KnexPersonalDataErasure, ${erasure}`,
    create: async () => {
      await database.truncate();

      return {
        declaration: declarationOf(erasure),
        erasure: erasureOf(erasure, workIn('acme')),
        insert,
        rowsOf: (subject) => rowsOf(subject),
        aRowOf: (subject, n) => aPersonRow(subject, n),
      };
    },
  });
}

describe('KnexPersonalDataErasure', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('confines the erasure to the tenant of the work, and never widens it under an elevation', async () => {
    await insert([aPersonRow('ada', 1, 'acme'), aPersonRow('ada', 1, 'north')]);

    const elevated = workIn('acme', { reason: 'ERASURE', tenants: 'all' });

    expect(await erasureOf('row', elevated).erase('ada')).toBe(1);
    expect(await rowsOf('ada', 'acme')).toEqual([]);
    expect(await rowsOf('ada', 'north')).toEqual([aPersonRow('ada', 1, 'north')]);
  });

  it('refuses work that names no tenant on a table of tenant data, before any statement', async () => {
    await insert([aPersonRow('ada', 1)]);
    database.queries.length = 0;

    await expect(erasureOf('row', workIn(undefined)).erase('ada')).rejects.toThrow(NoCurrentTenantError);

    expect(database.queries).toEqual([]);
    expect(await rowsOf('ada')).toHaveLength(1);
  });

  it('deletes the files of the subject from the storage before it forgets them, and leaves the files of the others', async () => {
    const files = new InMemoryFileStorage();
    const ada = aPersonRow('ada', 1);
    const bob = aPersonRow('bob', 1);

    for (const row of [ada, bob]) {
      await files.put(row.avatar_key ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    }

    await insert([ada, bob]);

    expect(await erasureOf('pseudonymise', workIn('acme'), files).erase('ada')).toBe(1);

    expect(await files.stat(ada.avatar_key ?? '')).toBeUndefined();
    expect(await files.stat(bob.avatar_key ?? '')).toBeDefined();
    expect((await rowsOf('ada'))[0]).toMatchObject({ avatar_key: null, display_name: ERASED_PERSONAL_DATA, age: null });
  });

  it('refuses a subject that is not an opaque identifier before any statement', async () => {
    database.queries.length = 0;

    await expect(erasureOf('row', workIn('acme')).erase('ada@example.org')).rejects.toThrow(NotADataSubjectIdError);

    expect(database.queries).toEqual([]);
  });

  it('refuses, when built, a declaration that names file columns without a file storage', () => {
    expect(
      () =>
        new KnexPersonalDataErasure(createKnexUnitOfWork(database.knex), {
          name: 'identity.people',
          declarations: [declarationOf('row')],
        }),
    ).toThrow('names file columns (avatar_key) and no file storage was given');
  });

  it('reaches the rows of the subject in every tenant when the table is not declared tenant data', async () => {
    await insert([aPersonRow('ada', 1, 'acme'), aPersonRow('ada', 1, 'north'), aPersonRow('bob', 1, 'acme')]);

    const everywhere = new KnexPersonalDataErasure(createKnexUnitOfWork(database.knex), {
      name: 'identity.people',
      declarations: [declarationOf('row')],
      files: new InMemoryFileStorage(),
    });

    expect(await everywhere.erase('ada')).toBe(2);
    expect(await rowsOf('bob')).toHaveLength(1);
  });

  it('refuses to pseudonymise a column that is not a text and does not accept null, before any file or row is touched', async () => {
    const files = new InMemoryFileStorage();
    const ada = aPersonRow('ada', 1);

    await files.put(ada.avatar_key ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    await database.knex.withSchema(PRIVACY).insert([ada]).into('people_strict');

    const strict = new KnexPersonalDataErasure(createKnexUnitOfWork(database.knex), {
      name: 'identity.people',
      declarations: [
        personalFields<PersonRow, TenantTableTarget>(PEOPLE_STRICT, {
          subject: 'person_id',
          fields: ['display_name', 'email', 'age'],
          files: ['avatar_key'],
          erasure: 'pseudonymise',
        }),
      ],
      tenant: new FixedExecutionScope(workIn('acme')),
      files,
    });

    await expect(strict.erase('ada')).rejects.toThrow(NotNullablePersonalColumnError);

    expect(await files.stat(ada.avatar_key ?? '')).toBeDefined();

    expect(
      await database.knex.withSchema(PRIVACY).from<PersonRow>('people_strict').where({ person_id: 'ada' }),
    ).toEqual([ada]);
  });
});

/**
 * What the platform does to an adapter once it is bound: tracing and the aspects wrap every method,
 * and a method that answers a thenable is read as asynchronous, its answer awaited and a promise
 * answered in its place. A helper that answered a query builder would be run, and its chain broken.
 */
function boundInAnApplication<T extends object>(adapter: T): T {
  for (let owner: object | null = Reflect.getPrototypeOf(adapter); owner !== null && owner !== Object.prototype; ) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      const original: unknown = Reflect.get(adapter, name);

      if (name !== 'constructor' && typeof original === 'function') {
        Object.defineProperty(adapter, name, {
          value: (...args: unknown[]): unknown => {
            const result: unknown = original.apply(adapter, args);

            return typeof result === 'object' && result !== null && 'then' in result ? Promise.resolve(result) : result;
          },
          configurable: true,
          writable: true,
        });
      }
    }

    owner = Reflect.getPrototypeOf(owner);
  }

  return adapter;
}

describe('KnexPersonalDataErasure, bound in an application', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  for (const erasure of ['row', 'pseudonymise'] as const) {
    it(`erases through the wrappers of the platform, which await whatever a method answers (${erasure})`, async () => {
      await insert([aPersonRow('ada', 1), aPersonRow('bob', 1)]);

      const bound = boundInAnApplication(erasureOf(erasure, workIn('acme')));

      expect(await bound.erase('ada')).toBe(1);
      expect(await bound.erase('ada')).toBe(0);
      expect(await rowsOf('bob')).toHaveLength(1);
    });
  }
});
