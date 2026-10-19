import type { UnitOfWork } from '@ddd-ts-kit/kernel';
import type { AuditRecord, AuditTrailOptions } from '../../src/index.js';
import type { AuditTrailUnderContract } from '../../src/testing.js';
import { NOW } from './fixtures.js';

/** What a spec of a SQL store gives: a fresh schema with the tables and the guard, per call. */
export interface SqlTrailFixture {
  readonly trail: AuditTrailUnderContract;
  readonly unitOfWork: UnitOfWork;
  /**
   * Runs one statement on the connection of the unit of work in progress, or on the database.
   * `$table` names the entries table, `$schema` the schema of the trail.
   */
  run(statement: string): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
  /** The same trail, unit of work and `run` on a pool of their own, as another process would have. */
  elsewhere(): Omit<SqlTrailFixture, 'elsewhere'>;
}

export interface SqlTrailSpecs {
  readonly name: string;
  /** True when the tests run on a real server: several connections, real concurrency. */
  readonly real: boolean;
  create(options?: AuditTrailOptions): Promise<SqlTrailFixture>;
}

export const REAL_SERVER = (process.env['DDD_TS_KIT_TEST_DATABASE_URL'] ?? '') !== '';

export function aRecord(id: string, tenantId = 'acme'): AuditRecord {
  return {
    id,
    occurredAt: NOW,
    category: 'data-access',
    action: 'scheduling.appointments.export',
    outcome: 'succeeded',
    actor: { id: 'ada', type: 'user', tenantId },
    tenantId,
    correlationId: 'correlation-1',
    origin: 'http',
  };
}

export const CHAIN = 'tenant:acme';

/** The id and the sequence of every entry of a chain, in the order of the chain. */
export async function sequencesOf(
  trail: AuditTrailUnderContract,
  chain = CHAIN,
): Promise<{ readonly id: string; readonly sequence: number }[]> {
  const { items } = await trail.search(
    { chain },
    { kind: 'offset', offset: 0, limit: 100, sort: [{ field: 'sequence', direction: 'asc' }] },
  );

  return items.map(({ id, sequence }) => ({ id, sequence }));
}
