/**
 * What a write did to a read model. `applied`: a row was written, or a row it held was removed.
 * `traced`: a deletion found no row to remove and recorded its trace, under a key not held or
 * over the trace of an earlier deletion. `stale`: the row already holds this event or a later
 * one. `ignored`: the change had nothing to write (a patch of a row that does not exist, a
 * deletion under a key another tenant holds). Code that counts the rows it removed counts
 * `applied` alone.
 */
export type ReadModelWrite = 'applied' | 'traced' | 'stale' | 'ignored';
