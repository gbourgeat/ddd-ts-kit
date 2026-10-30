import { FixedClock, type AuditTrail } from '@ddd-ts-kit/kernel';
import type { ArchivableAuditTrail } from '../../src';
import type { AuditTrailUnderContract } from '../../src/testing';
import { aRecord } from './sql-trail-fixture';

/** A trail that archives, and what tampers with it the way somebody with access to the store would. */
export interface ArchiveFixture {
  readonly trail: AuditTrailUnderContract & ArchivableAuditTrail;
  /** Changes the action of an entry in the store itself, the guard set aside. */
  tamper(id: string): Promise<void>;
  /** A statement on the store: `$table` names the entries, `$schema` the schema of the trail. */
  run?(statement: string): Promise<unknown>;
}

export const JANUARY = new Date('2026-01-15T10:00:00.000Z');
export const FEBRUARY = new Date('2026-02-15T10:00:00.000Z');
export const MARCH = new Date('2026-03-15T10:00:00.000Z');
export const clock = new FixedClock(new Date('2026-04-01T00:00:00.000Z'));

export async function recordAt(trail: AuditTrail, id: string, at: Date, tenant = 'acme'): Promise<void> {
  await trail.record({ ...aRecord(id, tenant), occurredAt: at });
}
