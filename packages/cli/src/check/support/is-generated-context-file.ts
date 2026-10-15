import path from 'node:path';
import { barrelFile, dependenciesFile } from '../../declared/index.js';
import type { SourceFile } from '../model/source-file.js';

/** The generated files at the root of a declared context: `declarations/barrel-current` holds every line of them. */
export function isGeneratedContextFile(file: SourceFile): boolean {
  const name = path.posix.basename(file.path);
  const { location } = file;

  if (location.area !== 'context' || location.layer !== 'root' || location.inside.length > 0) {
    return false;
  }

  return name === barrelFile(location.context) || name === dependenciesFile(location.context);
}
