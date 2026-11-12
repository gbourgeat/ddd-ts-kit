/**
 * An advisory lock asked outside a unit of work: PostgreSQL holds it for the transaction, and a
 * statement alone is a transaction that ends at once, so the lock would protect nothing. A
 * mistake of wiring, never a business refusal: take the lock inside `unitOfWork.run`.
 */
export class AdvisoryLockOutsideUnitOfWorkError extends Error {
  constructor() {
    super(
      'An advisory lock is held until the end of the unit of work, and none is open: PostgreSQL would release it at once. Take it inside unitOfWork.run()',
    );

    this.name = 'AdvisoryLockOutsideUnitOfWorkError';
  }
}
