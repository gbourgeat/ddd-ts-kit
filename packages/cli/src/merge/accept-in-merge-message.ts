import fs from 'node:fs';
import { gitPath } from './git-path';

/**
 * Adds a `Lost-Accepted:` trailer to the message of the merge in progress: lines it does not keep
 * on purpose (a removal a person decided, a title merge-trunk renumbered), which verify-merge then
 * lists without failing, in this merge and after its commit.
 */
export function acceptInMergeMessage(top: string, entries: readonly string[]): void {
  if (entries.length === 0) {
    return;
  }

  const file = gitPath(top, 'MERGE_MSG');

  fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8').trimEnd()}\nLost-Accepted: ${entries.join(', ')}\n`);
}
