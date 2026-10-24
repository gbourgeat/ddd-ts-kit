import type { ErasureMode } from '@ddd-ts-kit/kernel';
import type { TenantTableTarget } from '../tenancy/tenant-table-target';

/** A `personalFields` declaration on a Knex table, whatever its row type: the table named as `tenantTable` names it, the columns by their SQL names. */
export interface KnexPersonalFields {
  readonly table: TenantTableTarget;
  readonly subject: string;
  readonly fields: readonly string[];
  readonly erasure: ErasureMode;
  readonly files: readonly string[];
}
