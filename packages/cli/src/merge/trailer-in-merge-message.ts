import fs from 'node:fs';
import { gitPath } from './git-path';

/**
 * Adds a trailer to the message of the merge in progress, each entry once: one the message already
 * holds under that key, from an earlier `--continue`, is not written again.
 */
export function trailerInMergeMessage(
  top: string,
  { key, entries }: { key: string; entries: readonly string[] },
): void {
  const file = gitPath(top, 'MERGE_MSG');
  const message = fs.readFileSync(file, 'utf8');

  const held = new Set(
    [...message.matchAll(new RegExp(`^${key}:(.*)$`, 'gm'))].flatMap((match) => (match[1] ?? '').split(/[\s,]+/)),
  );

  const added = [...new Set(entries)].filter((entry) => !held.has(entry));

  if (added.length > 0) {
    fs.writeFileSync(file, `${message.trimEnd()}\n${key}: ${added.join(', ')}\n`);
  }
}
