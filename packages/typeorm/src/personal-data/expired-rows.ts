import { LessThan, type ObjectLiteral } from 'typeorm';
import { expiredBefore } from '@ddd-ts-kit/kernel';
import type { TypeOrmErasureTenant } from './type-orm-personal-data-erasure-options';
import type { TypeOrmPersonalFields } from './type-orm-personal-fields';

const TENANT_PROPERTY = 'tenantId';

/**
 * The rows of a declared entity whose retention ended before `now`: their date property is earlier
 * than the end of the period, a row whose date is empty never expires. In the tenant of the work
 * when it names one, in every tenant when it names none: a purge is a policy of the table, run by
 * the platform, and a tenant left out of a list would keep what it should not.
 */
export function expiredRows(
  declaration: TypeOrmPersonalFields,
  { now, tenant }: { readonly now: Date; readonly tenant: TypeOrmErasureTenant | undefined },
): ObjectLiteral {
  const { retention } = declaration;

  if (retention === undefined) {
    throw new Error(`The declaration of ${declaration.table.options.name} gives no retention to purge by`);
  }

  const tenantId = tenant?.scope.current()?.tenantId;

  return {
    [retention.after]: LessThan(expiredBefore(retention, now)),
    ...(tenant === undefined || tenantId === undefined ? {} : { [tenant.property ?? TENANT_PROPERTY]: tenantId }),
  };
}
