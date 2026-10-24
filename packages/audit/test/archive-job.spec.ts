import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { ArchiveAuditEntries, InMemoryAuditTrail } from '../src';
import { aRecord } from './support/sql-trail-fixture';

async function trailWith(...instants: readonly string[]): Promise<InMemoryAuditTrail> {
  const trail = new InMemoryAuditTrail();

  for (const [position, instant] of instants.entries()) {
    await trail.record({ ...aRecord(`entry-${String(position)}`), occurredAt: new Date(instant) });
  }

  return trail;
}

describe('ArchiveAuditEntries', () => {
  it('archives the entries older than the whole months kept online, counted from the first day of the month in UTC', async () => {
    const trail = await trailWith('2025-04-30T23:59:59.999Z', '2025-05-01T00:00:00.000Z', '2026-05-20T08:00:00.000Z');

    const job = new ArchiveAuditEntries(
      trail,
      new InMemoryFileStorage(),
      new FixedClock(new Date('2026-05-20T09:00:00.000Z')),
    );

    await job.run();

    expect(trail.entries.map((entry) => entry.id)).toEqual(['entry-1', 'entry-2']);
    expect(await trail.archivesOf('tenant:acme')).toMatchObject([{ fromSequence: 1, toSequence: 1 }]);
  });

  it('keeps online the number of months it is given', async () => {
    const trail = await trailWith('2026-02-28T12:00:00.000Z', '2026-03-01T00:00:00.000Z');

    const job = new ArchiveAuditEntries(
      trail,
      new InMemoryFileStorage(),
      new FixedClock(new Date('2026-05-02T00:00:00.000Z')),
      2,
    );

    await job.run();

    expect(trail.entries.map((entry) => entry.id)).toEqual(['entry-1']);
  });

  it('archives nothing while every entry is within the months kept online', async () => {
    const trail = await trailWith('2026-01-10T00:00:00.000Z');

    const job = new ArchiveAuditEntries(
      trail,
      new InMemoryFileStorage(),
      new FixedClock(new Date('2026-05-02T00:00:00.000Z')),
    );

    await job.run();

    expect(trail.entries).toHaveLength(1);
    expect(await trail.archivesOf('tenant:acme')).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses to keep %s months online', (months) => {
    expect(
      () =>
        new ArchiveAuditEntries(
          new InMemoryAuditTrail(),
          new InMemoryFileStorage(),
          new FixedClock(new Date()),
          months,
        ),
    ).toThrow(RangeError);
  });
});
