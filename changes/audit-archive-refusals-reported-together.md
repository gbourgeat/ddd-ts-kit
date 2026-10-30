**A chain that does not verify stops its own archive, no other.** `archiveBefore` tries every chain, on the four SQL stores and on `InMemoryAuditTrail`, then throws `AuditArchiveRefusedError` once they all ran, with `refusals` (each with its `chain` and its `chainBreak`) and `archives` (what the other chains archived). A failure of the storage still ends the run where it is.

To move: `AuditArchiveRefusedError` holds `refusals` in place of `chain` and `chainBreak`, and its constructor takes them. Code that reads `error.chain` reads `error.refusals`.
