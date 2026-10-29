import type { ProjectDirectory } from './project-directories';

/** What the kit says of a directory of the config that leads out of the project, with its default inside it as the example. */
export function leavingDirectoryProblem(
  key: ProjectDirectory,
  value: string,
  inside: string,
): { message: string; fix: string } {
  return {
    message: `"${key}" is "${value}", which leads out of the project once "." and ".." are resolved: the generators would write there.`,
    fix: `Write it inside the project, relative to its root, such as "${inside}".`,
  };
}
