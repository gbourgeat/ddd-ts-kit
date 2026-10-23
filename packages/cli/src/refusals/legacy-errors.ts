import type { Config } from '../config';
import { roleFilesOf, treeOf } from '../model-modules';
import type { Workspace } from '../workspace';
import type { LegacyError } from './legacy-error';
import { readLegacyError } from './read-legacy-error';

/** Every class per error of the `domain/errors/` of every context and of its modules, in the order of their files. */
export function legacyErrors(ws: Workspace, config: Config): LegacyError[] {
  return Object.keys(config.contexts).flatMap((context) =>
    roleFilesOf(ws, treeOf(config, context), 'domain/errors')
      .filter(({ name }) => name.endsWith('.error.ts'))
      .flatMap(({ path: file }) => {
        const read = readLegacyError(ws.read(file) ?? '', { file, context });

        return read === undefined ? [] : [read];
      }),
  );
}
