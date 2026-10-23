import { ROLE_FOLDERS } from './role-folders.js';

/** True for a folder directly under `layer` that a role owns, false for a module or another layer. */
export function isRoleFolder(layer: string, folder: string): boolean {
  return ROLE_FOLDERS[layer]?.includes(folder) === true;
}
