import { normalizedDirectory } from './normalized-directory';
import type { ProjectDirectory } from './project-directories';
import { text } from './values/text';

/** Each directory of a written config, as written, the default of a missing one read from the source root. */
export function directoriesOf(raw: Readonly<Record<string, unknown>>): Record<ProjectDirectory, string> {
  const sourceRoot = text(raw['sourceRoot'], 'src');

  return {
    sourceRoot,
    contextsDir: text(raw['contextsDir'], `${normalizedDirectory(sourceRoot)}/contexts`),
    sharedKernelDir: text(raw['sharedKernelDir'], `${normalizedDirectory(sourceRoot)}/shared-kernel`),
    platformDir: text(raw['platformDir'], `${normalizedDirectory(sourceRoot)}/platform`),
  };
}
