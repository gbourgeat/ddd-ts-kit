import {
  FixedExecutionScope,
  InMemoryFileStorage,
  executionContext,
  personalFields,
  systemActor,
  type ErasureMode,
  type ExecutionContext,
  type TenantElevation,
} from '@ddd-ts-kit/kernel';
import { PrismaPersonalDataErasure, createPrismaUnitOfWork, type PrismaPersonalTable } from '../../../src';
import type { Prisma, PrismaClient } from '../../generated/client/client';

/** The rows as the table holds them, by SQL column: what a declaration on Prisma names. */
export interface PersonRow {
  readonly id: string;
  readonly person_id: string;
  readonly display_name: string;
  readonly email: string;
  readonly age: number | null;
  readonly avatar_key: string | null;
  readonly tenant_id: string;
  readonly registered_at: Date;
}

export const PEOPLE: PrismaPersonalTable = { schema: 'privacy', table: 'people' };
/** The same table, its `age` not nullable: what a pseudonymisation cannot write to. */
export const PEOPLE_STRICT: PrismaPersonalTable = { schema: 'privacy', table: 'people_strict' };

const COLUMNS = [
  'id',
  'person_id',
  'display_name',
  'email',
  'age',
  'avatar_key',
  'tenant_id',
  'registered_at',
] as const;

export function aPersonRow(subject: string, n: number, tenant = 'acme'): PersonRow {
  return {
    id: `${tenant}:${subject}-${String(n)}`,
    person_id: subject,
    display_name: `${subject} ${String(n)}`,
    email: `${subject}-${String(n)}@example.org`,
    age: 30 + n,
    avatar_key: `tenants/${tenant}/avatars/${subject}-${String(n)}`,
    tenant_id: tenant,
    registered_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

export function workIn(tenantId: string | undefined, elevation?: TenantElevation): ExecutionContext {
  return executionContext({
    correlationId: 'erasure-spec',
    actor: systemActor('erasure'),
    origin: 'cli',
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(elevation === undefined ? {} : { elevation }),
  });
}

export function declarationOf(erasure: ErasureMode) {
  return personalFields<PersonRow, PrismaPersonalTable>(PEOPLE, {
    subject: 'person_id',
    fields: ['display_name', 'email', 'age'],
    files: ['avatar_key'],
    erasure,
  });
}

/** The erasure of the people of a tenant, as a context would build it. */
export function erasureOf(
  prisma: PrismaClient,
  erasure: ErasureMode,
  context: ExecutionContext,
  files = new InMemoryFileStorage(),
) {
  return new PrismaPersonalDataErasure<Prisma.TransactionClient>(createPrismaUnitOfWork(prisma), {
    name: 'identity.people',
    declarations: [declarationOf(erasure)],
    tenant: { scope: new FixedExecutionScope(context) },
    files,
  });
}

/** Written as a repository would: by the model of the generated client. */
export const insertPeople = async (prisma: PrismaClient, rows: readonly PersonRow[]): Promise<void> => {
  await prisma.privacyPerson.createMany({
    data: rows.map((row) => ({
      id: row.id,
      personId: row.person_id,
      displayName: row.display_name,
      email: row.email,
      age: row.age,
      avatarKey: row.avatar_key,
      tenantId: row.tenant_id,
      registeredAt: row.registered_at,
    })),
  });
};

/** Read as the table holds them, so that the contract compares columns. */
export const peopleOf = async (prisma: PrismaClient, subject: string, tenant = 'acme'): Promise<PersonRow[]> => {
  const rows: unknown = await prisma.$queryRawUnsafe(
    `select ${COLUMNS.map((column) => `"${column}"`).join(', ')} from privacy.people where person_id = $1 and tenant_id = $2 order by id`,
    subject,
    tenant,
  );

  return Array.isArray(rows) ? rows.filter((row): row is PersonRow => typeof row === 'object' && row !== null) : [];
};

/** The same rows in the strict table, whose `age` cannot be null. */
export const insertPeopleStrict = async (prisma: PrismaClient, rows: readonly PersonRow[]): Promise<void> => {
  await prisma.privacyPersonStrict.createMany({
    data: rows.map((row) => ({
      id: row.id,
      personId: row.person_id,
      displayName: row.display_name,
      email: row.email,
      age: row.age ?? 0,
      avatarKey: row.avatar_key,
      tenantId: row.tenant_id,
      registeredAt: row.registered_at,
    })),
  });
};
