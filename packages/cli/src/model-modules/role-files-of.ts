import type { Workspace } from '../workspace/index.js';
import type { ContextTree } from './context-tree.js';
import type { RoleFile } from './role-file.js';
import { roleFoldersOf } from './role-folders-of.js';

/** The files directly inside the folder of a role, at the level of the context and in each of its modules. */
export function roleFilesOf(ws: Workspace, tree: ContextTree, folder: string): RoleFile[] {
  return roleFoldersOf(ws, tree, folder).flatMap((placed) =>
    ws.list(placed).map((name) => ({ name, path: `${placed}/${name}` })),
  );
}
