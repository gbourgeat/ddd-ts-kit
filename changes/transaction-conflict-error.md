**A deadlock or a serialization failure anywhere in the transaction of a unit of work rejects it with `TransactionConflictError`, a `ConcurrencyError`, instead of the raw error of the driver, and `@ddd-ts-kit/http` answers `CONCURRENCY_CONFLICT` with 409.**
When two transactions take the same locks in opposite orders, PostgreSQL gives up one statement of the
cycle with `40P01`, the one it chooses: an append of the event store or of the audit trail, which the
store already turned into a `ConcurrencyError`, but just as well the update of a row of the other
transaction, which reached the caller as an unexpected error (a 500 through `@ddd-ts-kit/http`). The same
went for a serialization failure (`40001`) under REPEATABLE READ or SERIALIZABLE. `withinUnitOfWork`, which
the units of work of `@ddd-ts-kit/knex`, `@ddd-ts-kit/drizzle`, `@ddd-ts-kit/prisma` and
`@ddd-ts-kit/typeorm` are built on, now rejects the outermost unit of work with `TransactionConflictError`
(code `CONCURRENCY_CONFLICT`, the error of the driver as `cause`) for `40P01` and `40001` of PostgreSQL,
the `40001` of a MySQL deadlock and `P2034` of Prisma, whatever wraps them. Nothing of the transaction
committed, so the command can run again. `ConcurrencyError` takes an optional `cause`. `DEFAULT_ERROR_MAPPING`
of `@ddd-ts-kit/http` now maps `CONCURRENCY_CONFLICT`, a lost update included, to 409 Conflict: it fell
back on 422, which a client reads as a request to correct, not to send again.

To move: a project that recognised `40P01` or `40001` itself, around a command or in its error mapping,
reads `ConcurrencyError` (or the code `CONCURRENCY_CONFLICT`) instead. A client or a test that expected 422
for `CONCURRENCY_CONFLICT` expects 409; a project that wants 422 back passes `{ CONCURRENCY_CONFLICT: 422 }`
to `createErrorMapper`.
