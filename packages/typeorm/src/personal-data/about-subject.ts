import type { ObjectLiteral } from 'typeorm';
import { tenantScopeOf } from '@ddd-ts-kit/kernel';
import type { TypeOrmErasureTenant } from './type-orm-personal-data-erasure-options';
import type { TypeOrmPersonalFields } from './type-orm-personal-fields';

const TENANT_PROPERTY = 'tenantId';

/** The rows about the subject, in the tenant of the work when the entity holds tenant data. */
export function aboutSubject(
  declaration: TypeOrmPersonalFields,
  subject: string,
  tenant: TypeOrmErasureTenant | undefined,
): ObjectLiteral {
  return {
    [declaration.subject]: subject,
    ...(tenant === undefined ? {} : { [tenant.property ?? TENANT_PROPERTY]: tenantScopeOf(tenant.scope).tenantId }),
  };
}
