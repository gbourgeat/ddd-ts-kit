import type { EntitySchema } from 'typeorm';
import type { ErasureMode, RetentionPeriod } from '@ddd-ts-kit/kernel';

/** A `personalFields` declaration on a TypeORM entity, whatever its row type: the entity schema itself, the columns by the properties of the entity. */
export interface TypeOrmPersonalFields {
  readonly table: EntitySchema;
  readonly subject: string;
  readonly fields: readonly string[];
  readonly erasure: ErasureMode;
  readonly files: readonly string[];
  /** How long the rows keep it, from a date column: what `purgeExpired` reads. */
  readonly retention?: RetentionPeriod & { readonly after: string };
}
