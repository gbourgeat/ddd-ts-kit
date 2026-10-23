import type { Config } from '../config';
import { moveFiles, type FileMoves } from '../file-moves';
import type { Workspace } from '../workspace';
import { movesIntoModule, type MoveRequest } from './moves-into-module';

/** What taking files into a module changed. */
export type ModuleMoves = FileMoves;

/**
 * Takes files of the model and of the use cases of a context into one of its modules, and
 * rewrites every import of them under the source root, `test/` and `scripts/`, by alias or
 * relative path, the extension kept as it was written.
 */
export function moveToModule(ws: Workspace, config: Config, request: MoveRequest): ModuleMoves {
  return moveFiles(ws, config, movesIntoModule(ws, config, request));
}
