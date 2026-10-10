import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from './in-context.js';

/** The path of a source relative to its context, the way the role table names files; undefined outside a context. */
export function pathInContext(project: Project, file: SourceFile): string | undefined {
  if (!inContext(file.location)) return undefined;

  return file.path.slice(`${project.config.contextsDir}/${file.location.context}/`.length);
}
