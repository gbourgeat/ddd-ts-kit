import { mentionedRows } from '../citations/mentioned-rows.js';
import type { GitRunner } from './attributed-marker.js';

/** The rows a commit belongs to. */
export interface CommitRows {
  readonly rows: readonly string[];
  /** True when its `Slice:` trailer named them, false when its message did. */
  readonly trailer: boolean;
}

const FORMAT = '--format=%H%x1f%(trailers:key=Slice,valueonly,separator=%x2C)%x1f%B%x1e';

/**
 * The rows each commit belongs to, by full hash: the ids of its `Slice:` trailer, else the ids of
 * rows its message names. One git call for every commit. A commit naming no row is left out.
 */
export function commitRows(
  root: string,
  shas: readonly string[],
  around: { readonly ids: readonly string[]; readonly git: GitRunner },
): Map<string, CommitRows> {
  const commits = new Map<string, CommitRows>();
  const output = shas.length === 0 ? undefined : around.git(root, ['show', '--no-patch', FORMAT, ...shas]);

  for (const record of (output ?? '').split('\x1e')) {
    const [sha = '', trailer = '', message = ''] = record.trim().split('\x1f');

    const trailed = trailer
      .split(',')
      .map((id) => id.trim().replace(/^#/, ''))
      .filter((id) => around.ids.includes(id));

    const rows = trailed.length > 0 ? trailed : mentionedRows(message, around.ids);

    if (sha !== '' && rows.length > 0) {
      commits.set(sha, { rows, trailer: trailed.length > 0 });
    }
  }

  return commits;
}
