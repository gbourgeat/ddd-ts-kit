import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { sourceAt } from '../project/source-at.js';
import type { ClassShape } from '../structure/class-shape.js';
import { importedFrom } from '../support/imported-from.js';

/**
 * The class `name` used in `file`: declared there, or in the file a direct relative or alias
 * import of it points to. Undefined when it comes from a package or cannot be read.
 */
export function classDeclaring(project: Project, file: SourceFile, name: string): ClassShape | undefined {
  const local = file.structure.classes.find((shape) => shape.name === name && shape.depth === 0);

  if (local !== undefined) return local;

  const target = importedFrom(file, name)?.target;
  const source = target?.kind === 'file' ? sourceAt(project, target.path) : undefined;

  return source?.structure.classes.find((shape) => shape.name === name && shape.depth === 0);
}
