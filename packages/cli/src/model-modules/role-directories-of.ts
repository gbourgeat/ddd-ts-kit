import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import type { RoleFile } from './role-file';
import { roleFoldersOf } from './role-folders-of';

/** The folders directly inside the folder of a role, such as the use cases of `application/commands`, in every module. */
export function roleDirectoriesOf(ws: Workspace, tree: ContextTree, folder: string): RoleFile[] {
  return roleFoldersOf(ws, tree, folder).flatMap((placed) =>
    ws.directories(placed).map((name) => ({ name, path: `${placed}/${name}` })),
  );
}
