import type { PgTable } from 'drizzle-orm/pg-core';
import type { ErasureMode } from '@ddd-ts-kit/kernel';

/** A `personalFields` declaration on a Drizzle table, whatever its row type: the table itself, the columns by the keys of its definition. */
export interface DrizzlePersonalFields {
  readonly table: PgTable;
  readonly subject: string;
  readonly fields: readonly string[];
  readonly erasure: ErasureMode;
  readonly files: readonly string[];
}
