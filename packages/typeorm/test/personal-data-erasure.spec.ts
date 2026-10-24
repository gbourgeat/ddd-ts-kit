import { Readable } from 'node:stream';
import type { EntitySchema } from 'typeorm';
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
import { TypeOrmPersonalDataErasure, createTypeOrmUnitOfWork } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import {
  aPersonRow,
  people,
  peopleByConstructor,
  peopleStrict,
  type PersonRow,
} from './support/personal-data/people-entity';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([people, peopleStrict, peopleByConstructor]);
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
  return personalFields<PersonRow, EntitySchema>(people, {
    subject: 'personId',
    fields: ['displayName', 'email', 'age'],
    files: ['avatarKey'],
    erasure,
  });
}

function erasureOf(erasure: ErasureMode, context: ExecutionContext, files = new InMemoryFileStorage()) {
  return new TypeOrmPersonalDataErasure(createTypeOrmUnitOfWork(database.dataSource), {
    name: 'identity.people',
    declarations: [declarationOf(erasure)],
    tenant: { scope: new FixedExecutionScope(context) },
    files,
  });
}

const insert = async (rows: readonly PersonRow[]): Promise<void> => {
  await database.dataSource.getRepository(people).insert([...rows]);
};

const rowsOf = (subject: string, tenant = 'acme'): Promise<PersonRow[]> =>
  database.dataSource
    .getRepository(people)
    .find({ where: { personId: subject, tenantId: tenant }, order: { id: 'ASC' } });

for (const erasure of ['row', 'pseudonymise'] as const) {
  personalDataErasureContract<PersonRow>(runner, {
    name: `TypeOrmPersonalDataErasure, ${erasure}`,
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

describe('TypeOrmPersonalDataErasure', () => {
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
      await files.put(row.avatarKey ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    }

    await insert([ada, bob]);

    expect(await erasureOf('pseudonymise', workIn('acme'), files).erase('ada')).toBe(1);

    expect(await files.stat(ada.avatarKey ?? '')).toBeUndefined();
    expect(await files.stat(bob.avatarKey ?? '')).toBeDefined();
    expect((await rowsOf('ada'))[0]).toMatchObject({ avatarKey: null, displayName: ERASED_PERSONAL_DATA, age: null });
  });

  it('refuses a subject that is not an opaque identifier before any statement', async () => {
    database.queries.length = 0;

    await expect(erasureOf('row', workIn('acme')).erase('ada@example.org')).rejects.toThrow(NotADataSubjectIdError);

    expect(database.queries).toEqual([]);
  });

  it('refuses, when built, a declaration that names file columns without a file storage', () => {
    expect(
      () =>
        new TypeOrmPersonalDataErasure(createTypeOrmUnitOfWork(database.dataSource), {
          name: 'identity.people',
          declarations: [declarationOf('row')],
        }),
    ).toThrow('names file columns (avatarKey) and no file storage was given');
  });

  it('reaches the rows of the subject in every tenant when the entity is not declared tenant data', async () => {
    await insert([aPersonRow('ada', 1, 'acme'), aPersonRow('ada', 1, 'north'), aPersonRow('bob', 1, 'acme')]);

    const everywhere = new TypeOrmPersonalDataErasure(createTypeOrmUnitOfWork(database.dataSource), {
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

    await files.put(ada.avatarKey ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    await database.dataSource.getRepository(peopleStrict).insert([ada]);
    database.queries.length = 0;

    const strict = new TypeOrmPersonalDataErasure(createTypeOrmUnitOfWork(database.dataSource), {
      name: 'identity.people',
      declarations: [
        personalFields<PersonRow, EntitySchema>(peopleStrict, {
          subject: 'personId',
          fields: ['displayName', 'email', 'age'],
          files: ['avatarKey'],
          erasure: 'pseudonymise',
        }),
      ],
      tenant: { scope: new FixedExecutionScope(workIn('acme')) },
      files,
    });

    await expect(strict.erase('ada')).rejects.toThrow(NotNullablePersonalColumnError);

    expect(database.queries).toEqual([]);
    expect(await files.stat(ada.avatarKey ?? '')).toBeDefined();
    expect(await database.dataSource.getRepository(peopleStrict).find({ where: { personId: 'ada' } })).toEqual([ada]);
  });
});

/** A declaration with no file column: what most tables of a context are. */
interface MistypedRow extends PersonRow {
  readonly nickname: string;
}

describe('TypeOrmPersonalDataErasure, the entity as declared', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('needs no file storage for a declaration without file columns, and deletes the rows of the subject', async () => {
    await insert([aPersonRow('ada', 1), aPersonRow('bob', 1)]);

    const plain = new TypeOrmPersonalDataErasure(createTypeOrmUnitOfWork(database.dataSource), {
      name: 'identity.people',
      declarations: [
        personalFields<PersonRow, EntitySchema>(people, {
          subject: 'personId',
          fields: ['displayName', 'email'],
          erasure: 'row',
        }),
      ],
      tenant: { scope: new FixedExecutionScope(workIn('acme')) },
    });

    expect(await plain.erase('ada')).toBe(1);
    expect(await rowsOf('ada')).toEqual([]);
    expect(await rowsOf('bob')).toHaveLength(1);
  });

  it('refuses a declaration that names a property the entity does not have, before any statement', async () => {
    await insert([aPersonRow('ada', 1)]);
    database.queries.length = 0;

    const mistyped = new TypeOrmPersonalDataErasure(createTypeOrmUnitOfWork(database.dataSource), {
      name: 'identity.people',
      declarations: [
        personalFields<MistypedRow, EntitySchema>(people, {
          subject: 'personId',
          fields: ['nickname'],
          erasure: 'pseudonymise',
        }),
      ],
      tenant: { scope: new FixedExecutionScope(workIn('acme')) },
    });

    await expect(mistyped.erase('ada')).rejects.toThrow('has no property "nickname"');

    expect(database.queries).toEqual([]);
    expect(await rowsOf('ada')).toHaveLength(1);
  });

  it('reads the type of a column declared by its constructor: a String is a text, a Number is not', async () => {
    const ada = aPersonRow('ada', 1);

    await database.dataSource.getRepository(peopleByConstructor).insert([ada]);

    const typed = new TypeOrmPersonalDataErasure(createTypeOrmUnitOfWork(database.dataSource), {
      name: 'identity.people',
      declarations: [
        personalFields<PersonRow, EntitySchema>(peopleByConstructor, {
          subject: 'personId',
          fields: ['displayName', 'email', 'age'],
          files: ['avatarKey'],
          erasure: 'pseudonymise',
        }),
      ],
      tenant: { scope: new FixedExecutionScope(workIn('acme')) },
      files: new InMemoryFileStorage(),
    });

    expect(await typed.erase('ada')).toBe(1);

    expect(await database.dataSource.getRepository(peopleByConstructor).find({ where: { personId: 'ada' } })).toEqual([
      { ...ada, displayName: ERASED_PERSONAL_DATA, email: ERASED_PERSONAL_DATA, age: null, avatarKey: null },
    ]);
  });
});
