import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { earlierPlaceOf } from '../../context-files';
import { moduleSplit } from '../../model-modules';
import { inContext } from './in-context';

/**
 * The path of a source relative to its context, the way the role table names files: its module of
 * the model left out, and the code list or the permission set at the root of the context read where
 * its role folder is. Undefined outside a context.
 */
export function pathInContext(project: Project, file: SourceFile): string | undefined {
  if (!inContext(file.location)) {
    return undefined;
  }

  const relative = file.path.slice(`${project.config.contextsDir}/${file.location.context}/`.length);
  const { module } = file.location;

  if (module !== undefined) {
    return moduleSplit(relative, [module]).path;
  }

  return earlierPlaceOf(file.location.context, relative) ?? relative;
}
