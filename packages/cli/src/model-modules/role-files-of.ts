import type { Workspace } from '../workspace/index.js';
import type { RoleFile } from './role-file.js';
import { roleFoldersOf } from './role-folders-of.js';

/** The files directly inside the folder of a role, at the level of the context and in each of its modules. */
export function roleFilesOf(ws: Workspace, directory: string, folder: string): RoleFile[] {
  return roleFoldersOf(ws, directory, folder).flatMap((placed) =>
    ws.list(placed).map((name) => ({ name, path: `${placed}/${name}` })),
  );
}
