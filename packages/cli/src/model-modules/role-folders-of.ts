import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { intoModule } from './into-module';

/**
 * Every folder of a context that plays one role, by its path from the project root: the folder
 * of the context itself (`domain/aggregates`) and the same folder in each module of its model
 * (`domain/calendars/aggregates`). A reader that lists a role goes through here, so a file moved
 * into a module is never lost from what the kit writes about its context.
 */
export function roleFoldersOf(ws: Workspace, { directory, modules }: ContextTree, folder: string): string[] {
  const placed = modules.map((module) => intoModule(module, folder)).filter((candidate) => candidate !== folder);

  return [folder, ...placed]
    .filter((candidate) => ws.exists(`${directory}/${candidate}`) || candidate === folder)
    .map((candidate) => `${directory}/${candidate}`);
}
