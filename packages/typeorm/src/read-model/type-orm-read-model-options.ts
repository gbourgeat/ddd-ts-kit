import type { EntitySchema } from 'typeorm';
import type { ReadModelStamps } from './read-model-stamps';
import type { TypeOrmReadModelTenant } from './type-orm-read-model-tenant';

export interface TypeOrmReadModelOptions<Row> {
  /** The entity of the read model: the fields of the row and `...readModelColumns()`. */
  readonly entity: EntitySchema<Row & ReadModelStamps>;
  /** The property of the key, which is the primary column. Default `id`. */
  readonly key?: keyof Row & string;
  /** For a read model of tenant data: the scope that names the tenant of the work, and the property that holds it. */
  readonly tenant?: TypeOrmReadModelTenant;
}
