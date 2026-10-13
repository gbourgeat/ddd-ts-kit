/**
 * Work of one tenant run inside the open unit of work of another: it would join that tenant's
 * transaction (its database, its settings). One unit of work never spans tenants.
 */
export class CrossTenantUnitOfWorkError extends Error {
  constructor(open: string, requested: string) {
    super(
      `A unit of work of tenant "${open}" cannot run work of tenant "${requested}": open a unit of work per tenant`,
    );

    this.name = 'CrossTenantUnitOfWorkError';
  }
}
