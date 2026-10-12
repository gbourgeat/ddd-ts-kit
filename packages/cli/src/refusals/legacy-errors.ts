import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import type { LegacyError } from './legacy-error.js';
import { readLegacyError } from './read-legacy-error.js';

/** Every class per error of the `domain/errors/` of every context, in the order of their files. */
export function legacyErrors(ws: Workspace, config: Config): LegacyError[] {
  return Object.keys(config.contexts).flatMap((context) => {
    const directory = `${config.contextsDir}/${context}/domain/errors`;

    return ws
      .list(directory)
      .filter((name) => name.endsWith('.error.ts'))
      .flatMap((name) => {
        const file = `${directory}/${name}`;
        const read = readLegacyError(ws.read(file) ?? '', { file, context });

        return read === undefined ? [] : [read];
      });
  });
}
