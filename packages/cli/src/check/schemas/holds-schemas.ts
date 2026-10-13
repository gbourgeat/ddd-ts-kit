import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { sharedPresentation } from './shared-presentation.js';

/** A production source where the schemas of the HTTP contract live: presentation/ of a context, or of the shared kernel. */
export function holdsSchemas(project: Project, file: SourceFile): boolean {
  if (file.isTest) {
    return false;
  }

  const { location } = file;

  return location.area === 'context'
    ? location.layer === 'presentation'
    : file.path.startsWith(sharedPresentation(project.config));
}
