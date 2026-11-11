import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { SHARED_FOLDER } from './module-layers';

/**
 * Where a context keeps a folder of what belongs to none of its modules (`presentation/http`,
 * `infrastructure/persistence`, `test/worlds`), from the project root: in `shared/` once a context
 * divided into modules holds the folder there, at its own level otherwise.
 */
export function contextLevelFolderOf(ws: Workspace, { directory, modules }: ContextTree, folder: string): string {
  const shared = `${directory}/${SHARED_FOLDER}/${folder}`;

  return modules.length > 0 && ws.existsAsIs(shared) ? shared : `${directory}/${folder}`;
}
