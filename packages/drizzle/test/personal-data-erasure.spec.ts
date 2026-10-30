import { Readable } from 'node:stream';
import { and, eq } from 'drizzle-orm';
import type { PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';
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
import { DrizzlePersonalDataErasure, createDrizzleUnitOfWork } from '../src/postgres';
import { createDatabase } from './support/database';
import { aPersonRow, people, peopleStrict, type PersonRow } from './support/personal-data/people-table';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: Awaited<ReturnType<typeof createDatabase>>;

beforeAll(async () => {
  database = await createDatabase([people, peopleStrict]);
});

afterAll(async () => {
  await database.client.close();
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
  return personalFields<PersonRow, PgTable>(people, {
    subject: 'personId',
    fields: ['displayName', 'email', 'age'],
    files: ['avatarKey'],
    erasure,
  });
}

/** The same declaration without file column: what most tables of a context are. */
function plainDeclarationOf(erasure: ErasureMode) {
  return personalFields<PersonRow, PgTable>(people, {
    subject: 'personId',
    fields: ['displayName', 'email', 'age'],
    erasure,
  });
}

function erasureOf(erasure: ErasureMode, context: ExecutionContext, files = new InMemoryFileStorage()) {
  return new DrizzlePersonalDataErasure<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
    name: 'identity.people',
    declarations: [declarationOf(erasure)],
    tenant: { scope: new FixedExecutionScope(context) },
    files,
  });
}

const insert = async (rows: readonly PersonRow[]): Promise<void> => {
  await database.db.insert(people).values([...rows]);
};

const rowsOf = (subject: string, tenant = 'acme'): Promise<PersonRow[]> =>
  database.db
    .select()
    .from(people)
    .where(and(eq(people.personId, subject), eq(people.tenantId, tenant)))
    .orderBy(people.id);

for (const erasure of ['row', 'pseudonymise'] as const) {
  personalDataErasureContract<PersonRow>(runner, {
    name: `DrizzlePersonalDataErasure, ${erasure}`,
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
        erasure: new DrizzlePersonalDataErasure<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
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

describe('DrizzlePersonalDataErasure', () => {
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
    database.logger.queries.length = 0;

    await expect(erasureOf('row', workIn(undefined)).erase('ada')).rejects.toThrow(NoCurrentTenantError);

    expect(database.logger.queries).toEqual([]);
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
    database.logger.queries.length = 0;

    await expect(erasureOf('row', workIn('acme')).erase('ada@example.org')).rejects.toThrow(NotADataSubjectIdError);

    expect(database.logger.queries).toEqual([]);
  });

  it('refuses, when built, a declaration that names file columns without a file storage', () => {
    expect(
      () =>
        new DrizzlePersonalDataErasure<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
          name: 'identity.people',
          declarations: [declarationOf('row')],
        }),
    ).toThrow('names file columns (avatarKey) and no file storage was given');
  });

  it('refuses a tenant column the table does not have, before any statement', async () => {
    database.logger.queries.length = 0;

    const misnamed = new DrizzlePersonalDataErasure<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
      name: 'identity.people',
      declarations: [declarationOf('row')],
      tenant: { scope: new FixedExecutionScope(workIn('acme')), column: 'network_id' },
      files: new InMemoryFileStorage(),
    });

    await expect(misnamed.erase('ada')).rejects.toThrow('has no column "network_id"');
    expect(database.logger.queries).toEqual([]);
  });

  it('reaches the rows of the subject in every tenant when the table is not declared tenant data', async () => {
    await insert([aPersonRow('ada', 1, 'acme'), aPersonRow('ada', 1, 'north'), aPersonRow('bob', 1, 'acme')]);

    const everywhere = new DrizzlePersonalDataErasure<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
      name: 'identity.people',
      declarations: [declarationOf('row')],
      files: new InMemoryFileStorage(),
    });

    expect(await everywhere.erase('ada')).toBe(2);
    expect(await rowsOf('bob')).toHaveLength(1);
  });

  it('refuses to pseudonymise a column that is not a text and does not accept null, before any file or row is touched', async () => {
    const files = new InMemoryFileStorage();
    const ada = { ...aPersonRow('ada', 1), age: 31 };

    await files.put(ada.avatarKey ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    await database.db.insert(peopleStrict).values([ada]);
    database.logger.queries.length = 0;

    const strict = new DrizzlePersonalDataErasure<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
      name: 'identity.people',
      declarations: [
        personalFields<typeof peopleStrict.$inferSelect, PgTable>(peopleStrict, {
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

    expect(database.logger.queries).toEqual([]);
    expect(await files.stat(ada.avatarKey ?? '')).toBeDefined();
    expect(await database.db.select().from(peopleStrict).where(eq(peopleStrict.personId, 'ada'))).toEqual([ada]);
  });
});
