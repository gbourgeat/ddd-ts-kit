import { expiredBefore } from '@ddd-ts-kit/kernel';
import type { Condition } from './about-subject';
import type { PrismaErasureTenant } from './prisma-personal-data-erasure-options';
import type { PrismaPersonalFields } from './prisma-personal-fields';
import { quoted } from './quoted';

const TENANT_COLUMN = 'tenant_id';

/**
 * The rows of a declared table whose retention ended before `now`: their date column is earlier
 * than the end of the period, a row whose date is empty never expires. In the tenant of the work
 * when it names one, in every tenant when it names none: a purge is a policy of the table, run by
 * the platform, and a tenant left out of a list would keep what it should not.
 */
export function expiredRows(
  declaration: PrismaPersonalFields,
  { now, tenant }: { readonly now: Date; readonly tenant: PrismaErasureTenant | undefined },
): Condition {
  const { retention } = declaration;

  if (retention === undefined) {
    throw new Error(`The declaration of ${declaration.table.table} gives no retention to purge by`);
  }

  const expired = `${quoted(retention.after)} < $1`;
  const cutoff = expiredBefore(retention, now);
  const tenantId = tenant?.scope.current()?.tenantId;

  if (tenant === undefined || tenantId === undefined) {
    return { text: expired, values: [cutoff] };
  }

  return { text: `${expired} and ${quoted(tenant.column ?? TENANT_COLUMN)} = $2`, values: [cutoff, tenantId] };
}
