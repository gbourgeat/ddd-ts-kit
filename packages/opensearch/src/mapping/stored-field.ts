import type { FieldType } from '@ddd-ts-kit/kernel';

/** A field of the row as the index holds it: its type, and whether a read may filter and sort by it. */
export interface StoredField {
  readonly type: FieldType;
  readonly indexed: boolean;
}
