import type { Config } from '../config/index.js';
import { roleFilesOf } from '../model-modules/index.js';
import type { Workspace } from '../workspace/index.js';
import type { LegacyError } from './legacy-error.js';
import { readLegacyError } from './read-legacy-error.js';

/** Every class per error of the `domain/errors/` of every context and of its modules, in the order of their files. */
export function legacyErrors(ws: Workspace, config: Config): LegacyError[] {
  return Object.keys(config.contexts).flatMap((context) =>
    roleFilesOf(ws, `${config.contextsDir}/${context}`, 'domain/errors')
      .filter(({ name }) => name.endsWith('.error.ts'))
      .flatMap(({ path: file }) => {
        const read = readLegacyError(ws.read(file) ?? '', { file, context });

        return read === undefined ? [] : [read];
      }),
  );
}
