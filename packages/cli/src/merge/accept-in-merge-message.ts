import { trailerInMergeMessage } from './trailer-in-merge-message';

/**
 * Adds a `Lost-Accepted:` trailer to the message of the merge in progress: lines it does not keep
 * on purpose (a removal a person decided, a title merge-trunk renumbered), which verify-merge then
 * lists without failing, in this merge and after its commit.
 */
export function acceptInMergeMessage(top: string, entries: readonly string[]): void {
  trailerInMergeMessage(top, { key: 'Lost-Accepted', entries });
}
