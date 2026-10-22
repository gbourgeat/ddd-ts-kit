import type { Workspace } from '../workspace/index.js';
import { intoModule } from './into-module.js';
import { modulesOnDisk } from './modules-on-disk.js';

/**
 * Every folder of a context that plays one role, by its path from the project root: the folder
 * of the context itself (`domain/aggregates`) and the same folder in each of its modules
 * (`domain/calendars/aggregates`). A reader that lists a role goes through here, so a file moved
 * into a module is never lost from what the kit writes about its context.
 */
export function roleFoldersOf(ws: Workspace, directory: string, folder: string): string[] {
  const modules = modulesOnDisk(ws, directory).map((module) => intoModule(module, folder));

  return [folder, ...modules.filter((placed) => placed !== folder)].map((placed) => `${directory}/${placed}`);
}
