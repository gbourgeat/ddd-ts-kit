import type { EntitySchema } from 'typeorm';
import type { ReadModelStamps } from './read-model-stamps';

export interface TypeOrmReadModelOptions<Row> {
  /** The entity of the read model: the fields of the row and `...readModelColumns()`. */
  readonly entity: EntitySchema<Row & ReadModelStamps>;
  /** The property of the key, which is the primary column. Default `id`. */
  readonly key?: keyof Row & string;
}
