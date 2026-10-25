import path from 'node:path';
import { dependenciesFile, isDeclarationsFile } from '../../declared';
import { WITHOUT_MODULE } from '../../model-modules';
import { controllersFile } from '../../nest-controllers/controllers-file';
import type { SourceFile } from '../model/source-file';

/**
 * The generated files of a declared context: the declarations of each layer and their
 * summary at its root, or `<context>.dependencies.ts`; `declarations/barrel-current` holds every
 * line of them.
 */
export function isGeneratedContextFile(file: SourceFile): boolean {
  const { location } = file;

  if (location.area !== 'context') {
    return false;
  }

  const inContext =
    location.layer === 'root' && location.inside.length === 0
      ? path.posix.basename(file.path)
      : [location.layer, ...location.inside].join('/');

  return (
    isDeclarationsFile(location.context, inContext, WITHOUT_MODULE) ||
    inContext === dependenciesFile(location.context) ||
    inContext === controllersFile(location.context)
  );
}
