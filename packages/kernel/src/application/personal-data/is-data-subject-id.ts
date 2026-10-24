import { isTenantId } from '../tenancy/is-tenant-id';

/**
 * Whether a value may name a data subject: letters, digits, `_` and `-`, at most 63 characters,
 * what a slug or a UUID is made of, the grammar of a tenant id. A name or an email never matches,
 * so neither can reach the append-only audit trail through a mistyped argument.
 */
export function isDataSubjectId(value: unknown): value is string {
  return isTenantId(value);
}
