import type { PgColumn } from 'drizzle-orm/pg-core';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';

/** Where a read model of tenant data keeps the tenant of each row, and the scope that names it. */
export interface ReadModelTenant {
  readonly scope: ExecutionScope;
  readonly column: PgColumn;
}
