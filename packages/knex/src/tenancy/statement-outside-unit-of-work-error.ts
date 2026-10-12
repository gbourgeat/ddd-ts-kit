/** A statement asked of the database-per-tenant unit of work outside of a transaction: it would hold no tenant's database. */
export class StatementOutsideUnitOfWorkError extends Error {
  constructor() {
    super('Under database per tenant, every statement runs inside the unit of work (run): none is open');
    this.name = 'StatementOutsideUnitOfWorkError';
  }
}
