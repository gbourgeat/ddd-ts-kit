/**
 * What a write did to a read model: `applied`, `stale` when the row already holds this event
 * or a later one, `ignored` when the change had nothing to write (a patch or a deletion of a
 * row that does not exist).
 */
export type ReadModelWrite = 'applied' | 'stale' | 'ignored';
