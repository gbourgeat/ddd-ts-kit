/** The code of a unit of work the database could not serve in time: answered 503, to try again later. */
export const SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE';

/**
 * The unit of work got no transaction in time, every connection of the pool being busy, or ran
 * past the time its ORM allows a transaction: `P2028` and `P2024` of Prisma, the
 * `KnexTimeoutError` of the pool of Knex. A saturation of the infrastructure, not a business
 * refusal: a retry may succeed, a circuit breaker counts it, the error reporting sees it.
 * Nothing of it committed. The error of the driver is the `cause`.
 */
export class TransactionTimeoutError extends Error {
  readonly code = SERVICE_UNAVAILABLE;

  constructor(cause: unknown) {
    super('The database gave the unit of work no transaction in time, or ended it for running too long', { cause });
    this.name = 'TransactionTimeoutError';
  }
}
