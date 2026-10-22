import type { Config } from '../config';
import { roleFilesOf, treeOf } from '../model-modules';
import type { Workspace } from '../workspace';
import type { ConceptErrorClass } from './concept-error-class';
import { readConceptError } from './read-concept-error';

/** Every error class per concept of the `domain/errors/` of every context and of its modules, in the order of their files. */
export function conceptErrors(ws: Workspace, config: Config): ConceptErrorClass[] {
  return Object.keys(config.contexts).flatMap((context) =>
    roleFilesOf(ws, treeOf(config, context), 'domain/errors')
      .filter(({ name }) => name.endsWith('.error.ts'))
      .flatMap(({ path: file }) => {
        const read = readConceptError(ws.read(file) ?? '', { file, context });

        return read === undefined ? [] : [read];
      }),
  );
}
