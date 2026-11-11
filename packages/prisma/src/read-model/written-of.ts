import type { StampedRow } from '@ddd-ts-kit/kernel';

/**
 * What a stamped row writes, by field. A removed row keeps no data: each of `fields`, the
 * fields of the row, is written `null`, its key and its stamp apart.
 */
export function writtenOf<Row extends object>(
  { key, row, stamp }: StampedRow<Row>,
  keyField: string,
  fields: readonly string[],
): Record<string, unknown> {
  return {
    ...(row ?? Object.fromEntries(fields.map((field) => [field, null]))),
    [keyField]: key,
    lastEventId: stamp.eventId,
    lastEventAt: stamp.occurredAt,
    lastEventVersion: stamp.version === undefined ? null : BigInt(stamp.version),
    deleted: row === undefined,
  };
}
