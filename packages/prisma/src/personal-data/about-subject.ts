import { tenantScopeOf } from '@ddd-ts-kit/kernel';
import type { PrismaErasureTenant } from './prisma-personal-data-erasure-options';
import type { PrismaPersonalFields } from './prisma-personal-fields';
import { quoted } from './quoted';

const TENANT_COLUMN = 'tenant_id';

/** The condition of the rows about the subject, as SQL text with its parameters. */
export interface Condition {
  readonly text: string;
  readonly values: readonly unknown[];
}

/** The rows about the subject, in the tenant of the work when the table holds tenant data. */
export function aboutSubject(
  declaration: PrismaPersonalFields,
  subject: string,
  tenant: PrismaErasureTenant | undefined,
): Condition {
  if (tenant === undefined) {
    return { text: `${quoted(declaration.subject)} = $1`, values: [subject] };
  }

  return {
    text: `${quoted(declaration.subject)} = $1 and ${quoted(tenant.column ?? TENANT_COLUMN)} = $2`,
    values: [subject, tenantScopeOf(tenant.scope).tenantId],
  };
}
