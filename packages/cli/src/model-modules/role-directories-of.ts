import type { Workspace } from '../workspace/index.js';
import type { RoleFile } from './role-file.js';
import { roleFoldersOf } from './role-folders-of.js';

/** The folders directly inside the folder of a role, such as the use cases of `application/commands`, in every module. */
export function roleDirectoriesOf(ws: Workspace, directory: string, folder: string): RoleFile[] {
  return roleFoldersOf(ws, directory, folder).flatMap((placed) =>
    ws.directories(placed).map((name) => ({ name, path: `${placed}/${name}` })),
  );
}
