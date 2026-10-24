import { and, eq } from 'drizzle-orm';
import type { PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ERASED_PERSONAL_DATA,
  FixedExecutionScope,
  InMemoryFileStorage,
  NoCurrentTenantError,
  NotADataSubjectIdError,
  executionContext,
  personalFields,
  systemActor,
  type ExecutionContext,
  type TenantElevation,
} from '@ddd-ts-kit/kernel';
import { personalDataExportContract } from '@ddd-ts-kit/testing/contracts';
import {
  DrizzlePersonalDataErasure,
  DrizzlePersonalDataExport,
  createDrizzleUnitOfWork,
  type DrizzlePersonalFields,
} from '../src/postgres';
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
    correlationId: 'export-spec',
    actor: systemActor('export'),
    origin: 'cli',
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(elevation === undefined ? {} : { elevation }),
  });
}

function declarationOf(erasure: 'row' | 'pseudonymise', table: PgTable = people) {
  return personalFields<PersonRow, PgTable>(table, {
    subject: 'personId',
    fields: ['displayName', 'email', 'age'],
    files: ['avatarKey'],
    erasure,
  });
}

const strictDeclaration = () => declarationOf('pseudonymise', peopleStrict);

function exportOf(context: ExecutionContext) {
  return new DrizzlePersonalDataExport<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
    name: 'identity',
    declarations: [declarationOf('pseudonymise')],
    tenant: { scope: new FixedExecutionScope(context) },
  });
}

function exportEverywhere(declarations: readonly DrizzlePersonalFields[]) {
  return new DrizzlePersonalDataExport<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
    name: 'identity',
    declarations,
  });
}

function erasureOf(erasure: 'row' | 'pseudonymise', context: ExecutionContext) {
  return new DrizzlePersonalDataErasure<PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
    name: 'identity',
    declarations: [declarationOf(erasure)],
    tenant: { scope: new FixedExecutionScope(context) },
    files: new InMemoryFileStorage(),
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

/** The record of one row, as the export hands it over: the source names the export and the table, the values the declared columns alone. */
function recordOf(row: PersonRow, table = 'people') {
  return {
    source: `identity.${table}`,
    values: { displayName: row.displayName, email: row.email, age: row.age, avatarKey: row.avatarKey },
  };
}

personalDataExportContract<PersonRow>(runner, {
  name: 'DrizzlePersonalDataExport',
  create: async () => {
    await database.truncate();

    return {
      declaration: declarationOf('pseudonymise'),
      exporter: exportOf(workIn('acme')),
      insert,
      rowsOf: (subject) => rowsOf(subject),
      aRowOf: (subject, n) => aPersonRow(subject, n),
    };
  },
});

describe('DrizzlePersonalDataExport', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('names every record after the export and the table, and hands over the personal and file columns alone', async () => {
    const ada = aPersonRow('ada', 1);

    await insert([ada, aPersonRow('bob', 1)]);

    expect(await exportOf(workIn('acme')).exportOf('ada')).toEqual([recordOf(ada)]);
  });

  it('confines the export to the tenant of the work, and never widens it under an elevation', async () => {
    await insert([aPersonRow('ada', 1, 'acme'), aPersonRow('ada', 1, 'north')]);

    const elevated = workIn('acme', { reason: 'EXPORT', tenants: 'all' });

    expect(await exportOf(elevated).exportOf('ada')).toEqual([recordOf(aPersonRow('ada', 1, 'acme'))]);
  });

  it('refuses work that names no tenant on a table of tenant data, before any statement', async () => {
    await insert([aPersonRow('ada', 1)]);
    database.logger.queries.length = 0;

    await expect(exportOf(workIn(undefined)).exportOf('ada')).rejects.toThrow(NoCurrentTenantError);

    expect(database.logger.queries).toEqual([]);
  });

  it('refuses a subject that is not an opaque identifier before any statement', async () => {
    database.logger.queries.length = 0;

    await expect(exportOf(workIn('acme')).exportOf('ada@example.org')).rejects.toThrow(NotADataSubjectIdError);

    expect(database.logger.queries).toEqual([]);
  });

  it('reaches the rows of the subject in every tenant when the table is not declared tenant data', async () => {
    await insert([aPersonRow('ada', 1, 'acme'), aPersonRow('ada', 1, 'north'), aPersonRow('bob', 1, 'acme')]);

    const everywhere = exportEverywhere([declarationOf('pseudonymise')]);

    expect(await everywhere.exportOf('ada')).toEqual([
      recordOf(aPersonRow('ada', 1, 'acme')),
      recordOf(aPersonRow('ada', 1, 'north')),
    ]);
  });

  it('answers what a pseudonymised row reads, erased texts and nothing for the rest, and nothing of a deleted one', async () => {
    await insert([aPersonRow('ada', 1), aPersonRow('bob', 1)]);

    await erasureOf('pseudonymise', workIn('acme')).erase('ada');

    expect(await exportOf(workIn('acme')).exportOf('ada')).toEqual([
      {
        source: 'identity.people',
        values: { displayName: ERASED_PERSONAL_DATA, email: ERASED_PERSONAL_DATA, age: null, avatarKey: null },
      },
    ]);

    await erasureOf('row', workIn('acme')).erase('bob');

    expect(await exportOf(workIn('acme')).exportOf('bob')).toEqual([]);
  });

  it('gathers the records of every declared table, in the order of the declarations', async () => {
    const ada = aPersonRow('ada', 1);

    await insert([ada]);
    await database.db.insert(peopleStrict).values([{ ...ada, age: ada.age ?? 0 }]);

    const both = exportEverywhere([declarationOf('pseudonymise'), strictDeclaration()]);

    expect(await both.exportOf('ada')).toEqual([recordOf(ada), recordOf(ada, 'people_strict')]);
  });
});
