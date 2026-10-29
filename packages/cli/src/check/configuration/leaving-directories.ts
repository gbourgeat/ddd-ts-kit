import { insideDefaultsOf, leavesProject, leavingDirectoryProblem, PROJECT_DIRECTORIES } from '../../config';
import { normalizedDirectory } from '../../config/normalized-directory';

/** The directories of the config as written that lead out of the project, each with what config/valid says of it. */
export function leavingDirectories(
  raw: Readonly<Record<string, unknown>>,
): { key: string; message: string; fix: string }[] {
  const defaults = insideDefaultsOf(raw);

  return PROJECT_DIRECTORIES.flatMap((key) => {
    const value = raw[key];

    return typeof value === 'string' && leavesProject(value)
      ? [{ key, ...leavingDirectoryProblem(key, value, normalizedDirectory(defaults[key])) }]
      : [];
  });
}
