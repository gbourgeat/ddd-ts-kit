import { describe, expect, it } from 'vitest';
import { lockedIdOf } from '../src/outbox/locked-id-of';
import { lockingSelect } from '../src/outbox/locking-select';
import { toOutboxRecord } from '../src/outbox/to-outbox-record';

const row = {
  id: 'evt-1',
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: '2026-10-10T12:00:00.000Z',
  payload: { invoiceId: 'inv-1' },
  traceparent: null,
  correlationId: null,
  status: 'published',
  attempts: 2,
  nextAttemptAt: new Date('2026-10-10T12:00:00.000Z'),
  lastErrorCode: 'BROKER_UNAVAILABLE',
  publishedAt: new Date('2026-10-10T12:00:05.000Z'),
};

describe('the outbox rows of Prisma, without a database', () => {
  it('writes the locking select of MySQL with backticks and positional markers', () => {
    expect(lockingSelect({ dialect: 'mysql', schema: 'messaging' })).toBe(
      'select `id` from `messaging`.`outbox` where `status` = ? and `next_attempt_at` <= ? order by `next_attempt_at`, `sequence` limit ? for update skip locked',
    );
  });

  it('refuses a locked row that holds no id, rather than claiming nothing in silence', () => {
    expect(lockedIdOf({ id: 'evt-1' })).toBe('evt-1');

    for (const locked of [{ id: 7 }, {}, null, 'evt-1']) {
      expect(() => lockedIdOf(locked)).toThrow('without an id');
    }
  });

  it('keeps the moment of publication and the last failure of a record', () => {
    expect(toOutboxRecord(row)).toMatchObject({
      status: 'published',
      lastErrorCode: 'BROKER_UNAVAILABLE',
      publishedAt: row.publishedAt,
    });
  });

  it('refuses a status the outbox does not know', () => {
    expect(() => toOutboxRecord({ ...row, status: 'archived' })).toThrow('Unknown outbox status "archived"');
  });
});
