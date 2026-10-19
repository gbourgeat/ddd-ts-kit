import type { Config } from '../config/index.js';
import { authMoves } from '../platform-folders/index.js';
import { Workspace } from '../workspace/index.js';
import type { DoctorFinding } from './doctor-finding.js';

/** The files of the platform a project generated flat, where this version gives each the folder of what it answers. */
export function folderFindings(root: string, config: Config): DoctorFinding[] {
  const moves = authMoves(new Workspace(root, false), config);

  if (moves.length === 0) {
    return [];
  }

  return [
    {
      area: 'folder',
      name: `${config.platformDir}/auth`,
      problem: 'flat',
      expected: 'authentication/, authorization/ and the folder of the model',
      found: `${moves.length} files flat`,
    },
  ];
}
