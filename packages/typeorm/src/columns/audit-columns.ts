import type { EntitySchemaColumnOptions } from 'typeorm';
import type { AuditStamp } from '@ddd-ts-kit/kernel';
import { INDEXABLE_LENGTH } from './indexable-length.js';
import { INSTANT } from './instant.js';
import type { TypeOrmDialect } from './type-orm-dialect.js';

/**
 * The four audit columns, to spread into the `columns` of an `EntitySchema`. Their properties
 * are those of the kernel `AuditStamp`, so `stampCreation(scope, clock)` spreads into an insert
 * as it is, and their names (`created_at`, `created_by`, `updated_at`, `updated_by`) are the
 * same in every project.
 */
export function auditColumns(
  dialect: TypeOrmDialect = 'postgres',
): Record<keyof AuditStamp, EntitySchemaColumnOptions> {
  const instant = INSTANT[dialect];

  return {
    createdAt: { ...instant, name: 'created_at' },
    createdBy: { name: 'created_by', type: 'varchar', length: INDEXABLE_LENGTH },
    updatedAt: { ...instant, name: 'updated_at' },
    updatedBy: { name: 'updated_by', type: 'varchar', length: INDEXABLE_LENGTH },
  };
}
