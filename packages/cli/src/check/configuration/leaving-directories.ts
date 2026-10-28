import { leavesProject, leavingDirectoryProblem, PROJECT_DIRECTORIES } from '../../config';

/** The directories of the config as written that lead out of the project, each with what config/valid says of it. */
export function leavingDirectories(
  raw: Readonly<Record<string, unknown>>,
): { key: string; message: string; fix: string }[] {
  return PROJECT_DIRECTORIES.flatMap((key) => {
    const value = raw[key];

    return typeof value === 'string' && leavesProject(value) ? [{ key, ...leavingDirectoryProblem(key, value) }] : [];
  });
}
