import { directoriesOf } from './directories-of';
import { leavesProject } from './leaves-project';
import type { ProjectDirectory } from './project-directories';
import { text } from './values/text';

/** The default of each directory under the source root of a written config, or under `src` when that root leads out of the project. */
export function insideDefaultsOf(raw: Readonly<Record<string, unknown>>): Record<ProjectDirectory, string> {
  const sourceRoot = text(raw['sourceRoot'], 'src');

  return directoriesOf({ sourceRoot: leavesProject(sourceRoot) ? 'src' : sourceRoot });
}
