import { CliError } from '../cli-error';
import { CONFIG_FILE } from '../config';
import { leavingProject } from './leaving-project';
import { realPathOf, type RealPath } from './real-path-of';
import { realRootOf } from './real-root-of';

/**
 * Every write and removal of a command stays inside the project: a path that leads out of it,
 * through a symbolic link or a directory of the config, refuses the whole command before anything
 * is written, the paths named. Answers the real path of each file, resolved once: where it is written.
 */
export function refuseLeaving(
  root: string,
  files: readonly string[],
  absolute: (file: string) => string,
): ReadonlyMap<string, RealPath> {
  const project = realRootOf(root);
  const real = new Map(files.map((file): [string, RealPath] => [file, realPathOf(absolute(file))]));

  const leaving = files.flatMap((file) => {
    const way = leavingProject(project, absolute(file), real.get(file));

    if (way === undefined) {
      return [];
    }

    return [`${file} (which lands in ${way.to})`];
  });

  if (leaving.length > 0) {
    throw new CliError(
      `${leaving.length} file(s) of this command would be written out of the project: ${leaving.join(', ')}. Nothing was written.`,
      `The kit writes only inside the project: put the file or the folder itself in place of each symbolic link that leads out (or write the directory of ${CONFIG_FILE} inside the project), then run again.`,
    );
  }

  return real;
}
