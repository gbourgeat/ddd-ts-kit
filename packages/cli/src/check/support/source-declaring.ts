import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { sourceAt } from '../project/source-at.js';
import { importedFrom } from './imported-from.js';

/** The source that declares the class `name` used in `file`: the file its import points to, or the file itself. */
export function sourceDeclaring(project: Project, file: SourceFile, name: string): SourceFile {
  const imported = importedFrom(file, name)?.target;

  return (imported?.kind === 'file' ? sourceAt(project, imported.path) : undefined) ?? file;
}
