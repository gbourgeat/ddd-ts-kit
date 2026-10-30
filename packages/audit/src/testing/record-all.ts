import type { AuditRecord, AuditTrail } from '@ddd-ts-kit/kernel';

export async function recordAll(trail: AuditTrail, records: readonly AuditRecord[]): Promise<void> {
  for (const record of records) {
    await trail.record(record);
  }
}
