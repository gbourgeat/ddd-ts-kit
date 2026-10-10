import type { EntitySchemaColumnOptions } from 'typeorm';
import type { TypeOrmDialect } from './type-orm-dialect.js';

/** How every instant is stored, per database family. */
export const INSTANT: Record<TypeOrmDialect, EntitySchemaColumnOptions> = {
  postgres: { type: 'timestamp with time zone', precision: 3 },
  mysql: { type: 'datetime', precision: 3 },
  sqlite: { type: 'datetime' },
};
