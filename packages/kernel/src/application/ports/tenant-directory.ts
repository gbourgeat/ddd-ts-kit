/**
 * The tenants that exist, for work that runs once per tenant: a job declared `tenancy:
 * 'per-tenant'`, the provisioning of a schema or a database, a migration applied to each.
 */
export abstract class TenantDirectory {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.TenantDirectory' });
  }

  abstract tenants(): Promise<readonly string[]>;
}
