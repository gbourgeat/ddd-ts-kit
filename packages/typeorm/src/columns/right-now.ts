import type { TypeOrmDialect } from './type-orm-dialect';

// An explicit default rather than `createDate`, whose precision TypeORM does not align with
// the column's on MySQL.
export const RIGHT_NOW: Record<TypeOrmDialect, () => string> = {
  postgres: () => 'now()',
  mysql: () => 'CURRENT_TIMESTAMP(3)',
  sqlite: () => 'CURRENT_TIMESTAMP',
};
