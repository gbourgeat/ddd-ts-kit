import { aliasRoots } from '../alias/index.js';
import type { Config } from '../config/index.js';
import { projectSources } from '../refusals/project-sources.js';
import { withMovedImports } from '../platform-folders/with-moved-imports.js';
import type { Workspace } from '../workspace/index.js';
import type { ModuleMove } from './module-move.js';
import { movesIntoModule, type MoveRequest } from './moves-into-module.js';

const EXTENSION = /\.(?:ts|tsx|mts)$/;

/** What taking files into a module changed. */
export interface ModuleMoves {
  readonly moved: readonly ModuleMove[];
  /** The files whose imports now name the new paths, moved ones included. */
  readonly rewritten: readonly string[];
}

/**
 * Takes files of the model and of the use cases of a context into one of its modules, and
 * rewrites every import of them under the source root, `test/` and `scripts/`, by alias or
 * relative path, the extension kept as it was written.
 */
export function moveToModule(ws: Workspace, config: Config, request: MoveRequest): ModuleMoves {
  const moved = movesIntoModule(ws, config, request);

  const relocation = {
    roots: aliasRoots(config),
    moved: new Map(moved.map(({ from, to }) => [from.replace(EXTENSION, ''), to.replace(EXTENSION, '')])),
  };

  const rewritten = projectSources(ws, config, ['scripts']).flatMap((file) => {
    const source = ws.read(file) ?? '';
    const next = withMovedImports(source, file, relocation);
    const target = moved.find(({ from }) => from === file)?.to ?? file;

    if (target !== file) {
      ws.delete(file);
      ws.create(target, next);
    } else if (next !== source) {
      ws.update(file, next);
    }

    return next === source ? [] : [target];
  });

  return { moved, rewritten };
}
