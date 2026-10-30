/**
 * - `altered-content`: the entry does not hash to its `hash`, does not link to the entry
 *   before it, or disagrees with a checkpoint: something was rewritten.
 * - `missing-entry`: the expected position is nowhere in what was examined.
 * - `reordered`: the expected position exists, elsewhere, or a position appears twice.
 * - `unreadable-archive`: the storage failed to give back the file of an archive, so nothing past
 *   it is proved (`verifyTrail` given the storage).
 */
export type ChainBreakKind = 'altered-content' | 'missing-entry' | 'reordered' | 'unreadable-archive';
