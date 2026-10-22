import type { Config } from '../config/index.js';
import { roleFilesOf } from '../model-modules/index.js';
import type { Workspace } from '../workspace/index.js';
import type { ConceptErrorClass } from './concept-error-class.js';
import { readConceptError } from './read-concept-error.js';

/** Every error class per concept of the `domain/errors/` of every context and of its modules, in the order of their files. */
export function conceptErrors(ws: Workspace, config: Config): ConceptErrorClass[] {
  return Object.keys(config.contexts).flatMap((context) =>
    roleFilesOf(ws, `${config.contextsDir}/${context}`, 'domain/errors')
      .filter(({ name }) => name.endsWith('.error.ts'))
      .flatMap(({ path: file }) => {
        const read = readConceptError(ws.read(file) ?? '', { file, context });

        return read === undefined ? [] : [read];
      }),
  );
}
