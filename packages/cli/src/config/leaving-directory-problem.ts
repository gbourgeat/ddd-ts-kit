import type { ProjectDirectory } from './project-directories';

const DEFAULTS: Readonly<Record<ProjectDirectory, string>> = {
  sourceRoot: 'src',
  contextsDir: 'src/contexts',
  sharedKernelDir: 'src/shared-kernel',
  platformDir: 'src/platform',
};

/** What the kit says of a directory of the config that leads out of the project, and its default inside it. */
export function leavingDirectoryProblem(key: ProjectDirectory, value: string): { message: string; fix: string } {
  return {
    message: `"${key}" is "${value}", which leads out of the project once "." and ".." are resolved: the generators would write there.`,
    fix: `Write it inside the project, relative to its root, such as "${DEFAULTS[key]}".`,
  };
}
