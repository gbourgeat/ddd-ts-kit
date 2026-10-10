/** Tenant-scoped storage was reached by work that names no tenant: a wiring mistake. */
export class NoCurrentTenantError extends Error {
  constructor() {
    super('No current tenant: the execution context of this work names none');
    this.name = 'NoCurrentTenantError';
  }
}
