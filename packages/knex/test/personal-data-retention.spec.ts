import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedExecutionScope,
  InMemoryFileStorage,
  executionContext,
  personalFields,
  systemActor,
  type ErasureMode,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { personalDataRetentionContract } from '@ddd-ts-kit/testing/contracts';
import { KnexPersonalDataErasure, createKnexUnitOfWork, type TenantTableTarget } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import {
  PEOPLE,
  PEOPLE_PATH,
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

const NOW = new Date('2026-06-15T12:00:00.000Z');
const LONG_AGO = new Date('2024-01-01T00:00:00.000Z');

/** The work of a tenant, or of the platform when it names none. */
function workIn(tenantId: string | undefined): ExecutionContext {
  return executionContext({
    correlationId: 'retention-spec',
    actor: systemActor('privacy.purge-expired'),
    origin: 'job',
    ...(tenantId === undefined ? {} : { tenantId }),
  });
}

function declarationOf(erasure: ErasureMode) {
  return personalFields<PersonRow, TenantTableTarget>(PEOPLE, {
    subject: 'person_id',
    fields: ['display_name', 'email', 'age'],
    files: ['avatar_key'],
    erasure,
    retention: { after: 'ended_at', months: 6 },
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

function withoutRetention(context: ExecutionContext) {
  const { retention: _, ...kept } = declarationOf('row');

  return new KnexPersonalDataErasure(createKnexUnitOfWork(database.knex), {
    name: 'identity.people',
    declarations: [kept],
    tenant: new FixedExecutionScope(context),
    files: new InMemoryFileStorage(),
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

const rowsOfTenant = (tenant: string): Promise<PersonRow[]> =>
  database.knex.withSchema(PRIVACY).from<PersonRow>('people').where({ tenant_id: tenant });

for (const erasure of ['row', 'pseudonymise'] as const) {
  personalDataRetentionContract<PersonRow>(runner, {
    name: `KnexPersonalDataErasure, the retention, ${erasure}`,
    create: async () => {
      await database.truncate();

      return {
        declaration: declarationOf(erasure),
        retention: erasureOf(erasure, workIn('acme')),
        insert,
        rowsOf: (subject) => rowsOf(subject),
        aRowOf: (subject, n) => aPersonRow(subject, n),
        aRowFrom: (subject, n, at) => ({ ...aPersonRow(subject, n), ended_at: at }),
      };
    },
  });
}

describe('KnexPersonalDataErasure, the purge of what outlived its retention', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  const expired = (subject: string, tenant: string) => ({ ...aPersonRow(subject, 1, tenant), ended_at: LONG_AGO });

  it('purges in the tenant of the work alone when the work names one', async () => {
    await insert([expired('ada', 'acme'), expired('ada', 'north')]);

    expect(await erasureOf('row', workIn('acme')).purgeExpired(NOW)).toBe(1);
    expect(await rowsOfTenant('north')).toHaveLength(1);
  });

  it('purges in every tenant when the work names none, as the job of the platform runs it', async () => {
    await insert([expired('ada', 'acme'), expired('bob', 'north'), aPersonRow('cy', 1, 'north')]);

    expect(await erasureOf('row', workIn(undefined)).purgeExpired(NOW)).toBe(2);
    expect(await rowsOfTenant('north')).toHaveLength(1);
  });

  it('deletes the files an expired row names before it forgets them', async () => {
    const files = new InMemoryFileStorage();
    const row = expired('ada', 'acme');

    await files.put(row.avatar_key ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    await insert([row]);

    expect(await erasureOf('pseudonymise', workIn('acme'), files).purgeExpired(NOW)).toBe(1);
    expect(await files.stat(row.avatar_key ?? '')).toBeUndefined();
  });

  it('purges nothing in a table whose declaration gives no retention: kept until the person asks', async () => {
    await insert([expired('ada', 'acme')]);

    expect(await withoutRetention(workIn('acme')).purgeExpired(NOW)).toBe(0);
    expect(await rowsOf('ada')).toHaveLength(1);
  });
});
