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
  KnexPersonalDataErasure,
  KnexPersonalDataExport,
  createKnexUnitOfWork,
  type KnexPersonalFields,
  type TenantTableTarget,
} from '../src';
import { boundInAnApplication } from './support/bound-in-an-application';
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
    correlationId: 'export-spec',
    actor: systemActor('export'),
    origin: 'cli',
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(elevation === undefined ? {} : { elevation }),
  });
}

function declarationOf(erasure: 'row' | 'pseudonymise', table = PEOPLE) {
  return personalFields<PersonRow, TenantTableTarget>(table, {
    subject: 'person_id',
    fields: ['display_name', 'email', 'age'],
    files: ['avatar_key'],
    erasure,
  });
}

const strictDeclaration = () => declarationOf('pseudonymise', PEOPLE_STRICT);

function exportOf(context: ExecutionContext) {
  return new KnexPersonalDataExport(createKnexUnitOfWork(database.knex), {
    name: 'identity',
    declarations: [declarationOf('pseudonymise')],
    tenant: new FixedExecutionScope(context),
  });
}

function exportEverywhere(declarations: readonly KnexPersonalFields[]) {
  return new KnexPersonalDataExport(createKnexUnitOfWork(database.knex), { name: 'identity', declarations });
}

function erasureOf(erasure: 'row' | 'pseudonymise', context: ExecutionContext) {
  return new KnexPersonalDataErasure(createKnexUnitOfWork(database.knex), {
    name: 'identity',
    declarations: [declarationOf(erasure)],
    tenant: new FixedExecutionScope(context),
    files: new InMemoryFileStorage(),
  });
}

const insert = async (rows: readonly PersonRow[], table = 'people'): Promise<void> => {
  await database.knex
    .withSchema(PRIVACY)
    .insert([...rows])
    .into(table);
};

const rowsOf = (subject: string, tenant = 'acme'): Promise<PersonRow[]> =>
  database.knex
    .withSchema(PRIVACY)
    .from<PersonRow>('people')
    .where({ person_id: subject, tenant_id: tenant })
    .orderBy('id');

/** The record of one row, as the export hands it over: the source names the export and the table, the values the declared columns alone. */
function recordOf(row: PersonRow, table = 'people') {
  return {
    source: `identity.${table}`,
    values: { display_name: row.display_name, email: row.email, age: row.age, avatar_key: row.avatar_key },
  };
}

personalDataExportContract<PersonRow>(runner, {
  name: 'KnexPersonalDataExport',
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

describe('KnexPersonalDataExport', () => {
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
    await insert([ada], 'people_strict');

    const both = exportEverywhere([declarationOf('pseudonymise'), strictDeclaration()]);

    expect(await both.exportOf('ada')).toEqual([recordOf(ada), recordOf(ada, 'people_strict')]);
  });
});

describe('KnexPersonalDataExport, bound in an application', () => {
  it('exports through the wrappers of the platform, which await whatever a method answers', async () => {
    await database.truncate();

    const ada = aPersonRow('ada', 1);

    await insert([ada, aPersonRow('bob', 1)]);

    expect(await boundInAnApplication(exportOf(workIn('acme'))).exportOf('ada')).toEqual([recordOf(ada)]);
  });
});
