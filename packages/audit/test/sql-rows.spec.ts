import { describe, expect, it } from 'vitest';
import { cursorPage } from '@ddd-ts-kit/kernel';
import { GENESIS_HASH } from '../src';
import { auditTables } from '../src/sql/audit-tables';
import { PostgresAuditTrail } from '../src/sql/postgres-audit-trail';
import { rowsOf } from '../src/sql/rows-of';
import type { Sql } from '../src/sql/sql';
import type { SqlRow } from '../src/sql/sql-row';
import type { SqlSession } from '../src/sql/sql-session';
import { aRecord } from './support/sql-trail-fixture';

/** A session that answers every select with the rows it was given, as the driver of another kind hands them. */
class AnsweringSession implements SqlSession {
  readonly ambientTransaction = undefined;

  constructor(private readonly rows: readonly SqlRow[]) {}

  async query(statement: Sql): Promise<readonly SqlRow[]> {
    return statement.strings[0]?.startsWith('select') === true ? this.rows : [];
  }

  transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const row: SqlRow = {
  id: 'a-1',
  chain: 'tenant:acme',
  sequence: '1',
  occurred_at_utc: '2026-03-01T10:00:00.000Z',
  category: 'data-access',
  action: 'scheduling.appointments.export',
  outcome: 'succeeded',
  actor_id: 'ada',
  actor_type: 'user',
  actor_tenant_id: 'acme',
  tenant_id: 'acme',
  correlation_id: 'correlation-1',
  origin: 'http',
  changes: '{"status":"booked"}',
  extensions: '{"region":"eu"}',
  previous_hash: GENESIS_HASH,
  hash: 'hash-1',
};

const firstPage = cursorPage<'sequence'>({ limit: 10, sort: [{ field: 'sequence', direction: 'asc' }] });

function trailOver(rows: readonly SqlRow[]): PostgresAuditTrail {
  const session = new AnsweringSession(rows);

  return new PostgresAuditTrail(() => session, auditTables());
}

describe('the rows of the audit tables, as a driver hands them', () => {
  it('reads the instant as text, as a number or as a date, and the JSON columns as text', async () => {
    const rows = [row, { ...row, id: 'a-2', occurred_at_utc: 0 }, { ...row, id: 'a-3', occurred_at_utc: new Date(1) }];
    const { items } = await trailOver(rows).search({}, firstPage);

    expect(items).toMatchObject([
      {
        id: 'a-1',
        sequence: 1,
        occurredAt: new Date('2026-03-01T10:00:00.000Z'),
        actor: { id: 'ada', type: 'user', tenantId: 'acme' },
        changes: { status: 'booked' },
        extensions: { region: 'eu' },
        previousHash: GENESIS_HASH,
        hash: 'hash-1',
      },
      { id: 'a-2', occurredAt: new Date(0) },
      { id: 'a-3', occurredAt: new Date(1) },
    ]);
  });

  it.each([
    ['a text column that is none', { id: 42 }, 'Column id of an audit entry is not a text'],
    ['an instant that is none', { occurred_at_utc: null }, 'Column occurred_at of an audit entry is not an instant'],
    ['an outcome the trail does not know', { outcome: 'maybe' }, '"maybe" is not an audit outcome'],
    ['an actor type the trail does not know', { actor_type: 'robot' }, '"robot" is not an actor type'],
  ])('refuses a row holding %s, rather than answer an entry read wrong', async (_what, corrupted, message) => {
    await expect(trailOver([{ ...row, ...corrupted }]).search({}, firstPage)).rejects.toThrow(message);
  });

  it('refuses to append when the head of the chain cannot be read back once locked', async () => {
    await expect(trailOver([]).record(aRecord('a-1'))).rejects.toThrow(
      'The head of audit chain "tenant:acme" could not be read',
    );
  });
});

describe('rowsOf', () => {
  it('reads the rows of an array, of a result that holds them, and none of anything else', () => {
    expect(rowsOf([{ id: 'a-1' }, null, 'text'])).toEqual([{ id: 'a-1' }]);
    expect(rowsOf({ rows: [{ id: 'a-1' }] })).toEqual([{ id: 'a-1' }]);
    expect(rowsOf(42)).toEqual([]);
    expect(rowsOf(undefined)).toEqual([]);
  });
});
