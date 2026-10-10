import type { StampedRow } from '@ddd-ts-kit/kernel';

interface Read<Row> {
  readonly key: string;
  /** What holds the stamp: the model by field, or the record by column. */
  readonly stamps: readonly [eventId: unknown, occurredAt: unknown, version: unknown, deleted: unknown];
  readonly row: () => Row;
}

/** The stamped row of what was read from the model or from the table. */
export function stampedRowOf<Row>({ key, stamps: [eventId, occurredAt, version, deleted], row }: Read<Row>): StampedRow<Row> {
  return {
    key,
    row: deleted === true ? undefined : row(),
    stamp: {
      eventId: String(eventId),
      occurredAt: occurredAt instanceof Date ? occurredAt : new Date(String(occurredAt)),
      ...(version === null || version === undefined ? {} : { version: Number(version) }),
    },
  };
}
