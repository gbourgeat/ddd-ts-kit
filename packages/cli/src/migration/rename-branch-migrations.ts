import fs from 'node:fs';
import path from 'node:path';
import type { ReplayPlan } from './replay-plan.js';
import { replayedName } from './replayed-name.js';

/** A migration of the branch whose name changes, from its tag to the one it takes. */
export interface RenamedMigration {
  readonly from: string;
  readonly to: string;
}

/**
 * Gives the migrations of a branch that already follow the base the names a replay would give
 * them, without generating them again: the `.sql` file and the tag of its journal entry are
 * renamed, its number, its snapshot and its statements kept.
 */
export function renameBranchMigrations(
  { root, folder, migrations }: ReplayPlan,
  keepWorking: boolean,
): RenamedMigration[] {
  const journal = path.join(root, folder, 'meta', '_journal.json');
  const renamed: RenamedMigration[] = [];
  let text = fs.readFileSync(journal, 'utf8');

  for (const { tag } of migrations) {
    const at = tag.indexOf('_');
    const to = at === -1 ? tag : `${tag.slice(0, at)}_${replayedName(tag, keepWorking)}`;

    if (to !== tag) {
      fs.renameSync(path.join(root, folder, `${tag}.sql`), path.join(root, folder, `${to}.sql`));
      text = text.replace(JSON.stringify(tag), JSON.stringify(to));
      renamed.push({ from: tag, to });
    }
  }

  fs.writeFileSync(journal, text);

  return renamed;
}
