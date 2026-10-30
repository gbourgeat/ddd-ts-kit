import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ERASED_PERSONAL_DATA,
  FixedExecutionScope,
  InMemoryFileStorage,
  NoCurrentTenantError,
  NotADataSubjectIdError,
  NotNullablePersonalColumnError,
  personalFields,
  type ErasureMode,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { personalDataErasureContract } from '@ddd-ts-kit/testing/contracts';
import { PrismaPersonalDataErasure, createPrismaUnitOfWork, type PrismaPersonalTable } from '../../src';
import type { Prisma } from '../generated/client/client';
import { createDatabase, type TestDatabase } from '../support/database';
import {
  PEOPLE,
  PEOPLE_STRICT,
  aPersonRow,
  declarationOf,
  erasureOf as erasureOfPeople,
  insertPeople,
  peopleOf,
  workIn,
  type PersonRow,
} from '../support/personal-data/people';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const erasureOf = (erasure: ErasureMode, context: ExecutionContext, files?: InMemoryFileStorage) =>
  erasureOfPeople(database.prisma, erasure, context, files);

const insert = (rows: readonly PersonRow[]): Promise<void> => insertPeople(database.prisma, rows);

/** The same declaration without file column: what most tables of a context are. */
function plainDeclarationOf(erasure: ErasureMode) {
  return personalFields<PersonRow, PrismaPersonalTable>(PEOPLE, {
    subject: 'person_id',
    fields: ['display_name', 'email', 'age'],
    erasure,
  });
}

const rowsOf = (subject: string, tenant?: string): Promise<PersonRow[]> => peopleOf(database.prisma, subject, tenant);

for (const erasure of ['row', 'pseudonymise'] as const) {
  personalDataErasureContract<PersonRow>(runner, {
    name: `PrismaPersonalDataErasure, ${erasure}`,
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
    createWithoutFiles: async () => {
      await database.truncate();

      return {
        declaration: plainDeclarationOf(erasure),
        erasure: new PrismaPersonalDataErasure<Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
          name: 'identity.people',
          declarations: [plainDeclarationOf(erasure)],
          tenant: { scope: new FixedExecutionScope(workIn('acme')) },
        }),
        insert,
        rowsOf: (subject) => rowsOf(subject),
        aRowOf: (subject, n) => aPersonRow(subject, n),
      };
    },
  });
}

describe('PrismaPersonalDataErasure', () => {
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
        new PrismaPersonalDataErasure<Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
          name: 'identity.people',
          declarations: [declarationOf('row')],
        }),
    ).toThrow('names file columns (avatar_key) and no file storage was given');
  });

  it('reaches the rows of the subject in every tenant when the table is not declared tenant data', async () => {
    await insert([aPersonRow('ada', 1, 'acme'), aPersonRow('ada', 1, 'north'), aPersonRow('bob', 1, 'acme')]);

    const everywhere = new PrismaPersonalDataErasure<Prisma.TransactionClient>(
      createPrismaUnitOfWork(database.prisma),
      {
        name: 'identity.people',
        declarations: [declarationOf('row')],
        files: new InMemoryFileStorage(),
      },
    );

    expect(await everywhere.erase('ada')).toBe(2);
    expect(await rowsOf('bob')).toHaveLength(1);
  });

  it('refuses to pseudonymise a column that is not a text and does not accept null, before any file or row is touched', async () => {
    const files = new InMemoryFileStorage();
    const ada = aPersonRow('ada', 1);

    await files.put(ada.avatar_key ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });

    await database.prisma.privacyPersonStrict.create({
      data: {
        id: ada.id,
        personId: ada.person_id,
        displayName: ada.display_name,
        email: ada.email,
        age: ada.age ?? 0,
        avatarKey: ada.avatar_key,
        tenantId: ada.tenant_id,
        registeredAt: ada.registered_at,
      },
    });

    const strict = new PrismaPersonalDataErasure<Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
      name: 'identity.people',
      declarations: [
        personalFields<PersonRow, PrismaPersonalTable>(PEOPLE_STRICT, {
          subject: 'person_id',
          fields: ['display_name', 'email', 'age'],
          files: ['avatar_key'],
          erasure: 'pseudonymise',
        }),
      ],
      tenant: { scope: new FixedExecutionScope(workIn('acme')) },
      files,
    });

    await expect(strict.erase('ada')).rejects.toThrow(NotNullablePersonalColumnError);

    expect(await files.stat(ada.avatar_key ?? '')).toBeDefined();

    expect(
      await database.prisma.privacyPersonStrict.count({ where: { personId: 'ada', displayName: ada.display_name } }),
    ).toBe(1);
  });
});
