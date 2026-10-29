import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { isTeamFile } from './is-team-file';
import { MERGED_IGNORE_FILES } from './merged-ignore-files';
import { mergedIgnoreLines } from './merged-ignore-lines';

/**
 * Under --force, a file of the team that exists is kept, and an ignore file that exists gains the
 * lines of the kit it lacks; true when the file is settled so.
 */
export function keptOrMerged(
  ws: Workspace,
  config: Config,
  { target, content }: { target: string; content: string },
): boolean {
  const existing = ws.read(target);

  if (existing === undefined) {
    return false;
  }

  if (MERGED_IGNORE_FILES.includes(target)) {
    ws.update(target, mergedIgnoreLines(existing, content));

    return true;
  }

  if (isTeamFile(config, target)) {
    ws.keep(target);

    return true;
  }

  return false;
}
