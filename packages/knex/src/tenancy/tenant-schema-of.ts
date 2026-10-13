import { isTenantId } from '@ddd-ts-kit/kernel';
import { InvalidTenantIdentifierError } from './invalid-tenant-identifier-error.js';

/** The longest identifier PostgreSQL keeps whole: a longer one is truncated, and two tenants could meet. */
const LONGEST_IDENTIFIER = 63;

/**
 * The schema of a context for one tenant, under the schema-per-tenant strategy:
 * `tenantSchemaOf('billing', 'acme')` is `billing__acme`. A tenant id that a schema name could
 * not hold as it is (outside the grammar of `isTenantId`, or too long with the base) is refused, never altered: two tenants
 * must never share a schema.
 */
export function tenantSchemaOf(base: string, tenantId: string): string {
  if (!isTenantId(tenantId)) {
    throw new InvalidTenantIdentifierError(tenantId, 'it is outside the grammar of isTenantId');
  }

  const schema = `${base}__${tenantId}`;

  if (schema.length > LONGEST_IDENTIFIER) {
    throw new InvalidTenantIdentifierError(tenantId, `"${schema}" is longer than ${LONGEST_IDENTIFIER} characters`);
  }

  return schema;
}
