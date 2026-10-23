import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { inContext } from './in-context';

/** The path of a source relative to its context, the way the role table names files; undefined outside a context. */
export function pathInContext(project: Project, file: SourceFile): string | undefined {
  if (!inContext(file.location)) {
    return undefined;
  }

  const relative = file.path.slice(`${project.config.contextsDir}/${file.location.context}/`.length);
  const { layer, module } = file.location;

  return module === undefined ? relative : relative.replace(`${layer}/${module}/`, `${layer}/`);
}
