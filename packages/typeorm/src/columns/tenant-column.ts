import type { EntitySchemaColumnOptions } from 'typeorm';
import type { TenantScoped } from '@ddd-ts-kit/kernel';
import { INDEXABLE_LENGTH } from './indexable-length.js';

/** The tenant column, `tenant_id`, under the property of the kernel `TenantScoped`. */
export function tenantColumn(): Record<keyof TenantScoped, EntitySchemaColumnOptions> {
  return { tenantId: { name: 'tenant_id', type: 'varchar', length: INDEXABLE_LENGTH } };
}
