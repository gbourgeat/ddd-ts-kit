**`@ddd-ts-kit/audit`: inside a unit of work, `KnexAuditTrail` and `DrizzleAuditTrail` write the entries at its commit, so an append no longer ends in a PostgreSQL deadlock (`40P01`).**
An append used to lock the head of its chain at the call to `record` and hold it until the commit. A
unit of work that recorded (an authorization decision, an entry by hand) and then locked a row could
deadlock with another unit of work of the same tenant that held the row and appended to the same chain,
the head being created or not: PostgreSQL killed one of them with `40P01`, which reached the caller as an
error 500. The same happened between two units of work that appended to two chains in opposite orders.
The records of a unit of work now wait for its commit (`atCommit` of the kernel): they are written last,
after the work and its `before-commit` handlers, each chain once, the chains in the order of their names.
The head is the last lock a transaction takes, every transaction takes the heads in one order, and a unit
of work still at its work no longer makes the other writers of its tenant wait. Outside a unit of work an
entry is written at once, as before. Nothing changes in the tables, the hashes or the chains already
written.

To move: nothing for most projects. An entry recorded inside a unit of work is no longer visible inside it
before the commit, and a refusal of the store (an `id` written twice) now fails the commit instead of the
call to `record`: a test or a handler that read the trail back inside the same unit of work reads it after
the commit.
