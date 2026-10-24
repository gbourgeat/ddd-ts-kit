import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ERASED_PERSONAL_DATA,
  FixedExecutionScope,
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
  PrismaPersonalDataExport,
  createPrismaUnitOfWork,
  type PrismaPersonalFields,
  type PrismaPersonalTable,
} from '../../src';
import type { Prisma } from '../generated/client/client';
import { createDatabase, type TestDatabase } from '../support/database';
import {
  PEOPLE,
  PEOPLE_STRICT,
  aPersonRow,
  erasureOf as erasureOfPeople,
  insertPeople,
  insertPeopleStrict,
  peopleOf,
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

function workIn(tenantId: string | undefined, elevation?: TenantElevation): ExecutionContext {
  return executionContext({
    correlationId: 'export-spec',
    actor: systemActor('export'),
    origin: 'cli',
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(elevation === undefined ? {} : { elevation }),
  });
}

function declarationOf(erasure: 'row' | 'pseudonymise', table: PrismaPersonalTable = PEOPLE) {
  return personalFields<PersonRow, PrismaPersonalTable>(table, {
    subject: 'person_id',
    fields: ['display_name', 'email', 'age'],
    files: ['avatar_key'],
    erasure,
  });
}

const strictDeclaration = () => declarationOf('pseudonymise', PEOPLE_STRICT);

function exportOf(context: ExecutionContext) {
  return new PrismaPersonalDataExport<Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
    name: 'identity',
    declarations: [declarationOf('pseudonymise')],
    tenant: { scope: new FixedExecutionScope(context) },
  });
}

function exportEverywhere(declarations: readonly PrismaPersonalFields[]) {
  return new PrismaPersonalDataExport<Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
    name: 'identity',
    declarations,
  });
}

const erasureOf = (erasure: 'row' | 'pseudonymise', context: ExecutionContext) =>
  erasureOfPeople(database.prisma, erasure, context);

const insert = (rows: readonly PersonRow[]): Promise<void> => insertPeople(database.prisma, rows);

const rowsOf = (subject: string, tenant?: string): Promise<PersonRow[]> => peopleOf(database.prisma, subject, tenant);

/** The record of one row, as the export hands it over: the source names the export and the table, the values the declared columns alone. */
function recordOf(row: PersonRow, table = 'people') {
  return {
    source: `identity.${table}`,
    values: { display_name: row.display_name, email: row.email, age: row.age, avatar_key: row.avatar_key },
  };
}

personalDataExportContract<PersonRow>(runner, {
  name: 'PrismaPersonalDataExport',
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

describe('PrismaPersonalDataExport', () => {
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
    database.queries.length = 0;

    await expect(exportOf(workIn(undefined)).exportOf('ada')).rejects.toThrow(NoCurrentTenantError);

    expect(database.queries).toEqual([]);
  });

  it('refuses a subject that is not an opaque identifier before any statement', async () => {
    database.queries.length = 0;

    await expect(exportOf(workIn('acme')).exportOf('ada@example.org')).rejects.toThrow(NotADataSubjectIdError);

    expect(database.queries).toEqual([]);
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
        values: { display_name: ERASED_PERSONAL_DATA, email: ERASED_PERSONAL_DATA, age: null, avatar_key: null },
      },
    ]);

    await erasureOf('row', workIn('acme')).erase('bob');

    expect(await exportOf(workIn('acme')).exportOf('bob')).toEqual([]);
  });

  it('gathers the records of every declared table, in the order of the declarations', async () => {
    const ada = aPersonRow('ada', 1);

    await insert([ada]);
    await insertPeopleStrict(database.prisma, [ada]);

    const both = exportEverywhere([declarationOf('pseudonymise'), strictDeclaration()]);

    expect(await both.exportOf('ada')).toEqual([recordOf(ada), recordOf(ada, 'people_strict')]);
  });
});
