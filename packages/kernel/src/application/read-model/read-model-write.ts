/**
 * What a write did to a read model. `applied`: a row was written, or a row it held was removed.
 * `traced`: a deletion found no row to remove and recorded its trace, under a key not held or
 * over the trace of an earlier deletion. `stale`: the row already holds this event or a later
 * one. `ignored`: the change had nothing to write (an `upsertIfNewer` whose `next` answers
 * nothing, a deletion under a key another tenant holds). An `updateIfNewer` that finds no row to
 * change answers none of them: it throws `RowNotHeldError`. Code that counts the rows it removed counts
 * `applied` alone.
 */
export type ReadModelWrite = 'applied' | 'traced' | 'stale' | 'ignored';
