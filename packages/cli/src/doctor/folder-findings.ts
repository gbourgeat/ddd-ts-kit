import type { Config } from '../config';
import { platformMoves } from '../platform-folders';
import { Workspace } from '../workspace';
import type { DoctorFinding } from './doctor-finding';

/** The files of the platform a project generated flat, where this version gives each the folder of what it answers. */
export function folderFindings(root: string, config: Config): DoctorFinding[] {
  const moves = platformMoves(new Workspace(root, false), config);

  if (moves.length === 0) {
    return [];
  }

  return [
    {
      area: 'folder',
      name: config.platformDir,
      problem: 'flat',
      expected: 'composition/, observability/, jobs/, auth/<question>/, audit/search-audit-entries/',
      found: `${moves.length} files flat`,
    },
  ];
}
