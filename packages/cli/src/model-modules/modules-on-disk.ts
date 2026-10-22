import type { Workspace } from '../workspace/index.js';
import { isRoleFolder } from './is-role-folder.js';
import { MODULE_LAYERS } from './module-layers.js';

/** The modules a context holds on disk, declared or not: the folders under its layers that no role owns. */
export function modulesOnDisk(ws: Workspace, directory: string): string[] {
  const modules = MODULE_LAYERS.flatMap((layer) =>
    ws.directories(`${directory}/${layer}`).filter((folder) => !isRoleFolder(layer, folder)),
  );

  return [...new Set(modules)].sort();
}
