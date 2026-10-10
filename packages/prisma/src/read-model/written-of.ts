import type { StampedRow } from '@ddd-ts-kit/kernel';

/** What a stamped row writes, by field. A removed row keeps its fields and changes its stamp only. */
export function writtenOf<Row extends object>({ key, row, stamp }: StampedRow<Row>, keyField: string): Record<string, unknown> {
  return {
    ...row,
    [keyField]: key,
    lastEventId: stamp.eventId,
    lastEventAt: stamp.occurredAt,
    lastEventVersion: stamp.version === undefined ? null : BigInt(stamp.version),
    deleted: row === undefined,
  };
}
