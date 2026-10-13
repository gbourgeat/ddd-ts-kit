/**
 * The one grammar of a tenant id, wherever a tenant comes in: letters, digits, `_` and `-`, at
 * most 63 characters (what a slug or a UUID is made of). Nothing in it can be read as a list,
 * a wildcard, a key separator or a part of an SQL identifier, so no tenant id can ever widen
 * what another tenant reaches.
 */
const TENANT_ID = /^[A-Za-z0-9_-]{1,63}$/;

/** Whether a value is a tenant id of that grammar. */
export function isTenantId(value: unknown): value is string {
  return typeof value === 'string' && TENANT_ID.test(value);
}
