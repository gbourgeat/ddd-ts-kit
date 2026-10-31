import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { intoModule } from './into-module';
import { EARLIER_MODULE_LAYERS } from './module-layers';

/**
 * Every folder of a context that plays one role, by its path from the project root: the folder
 * of the context itself (`domain/aggregates`) and the same folder in each module of its model
 * (`calendars/domain/aggregates`, or `domain/calendars/aggregates` as 0.86 and 0.87 laid it out). A reader that lists a role goes through here, so a file moved
 * into a module is never lost from what the kit writes about its context.
 */
export function roleFoldersOf(ws: Workspace, { directory, modules }: ContextTree, folder: string): string[] {
  // Where a module holds the folder today, and where 0.86 and 0.87 put it, which context-layout moves.
  const placed = modules
    .flatMap((module) => [intoModule(module, folder), earlierPlace(module, folder)])
    .filter((candidate) => candidate !== folder);

  return (
    [folder, ...placed]
      // A folder a move is filling is planned before it is on disk.
      .filter((candidate) => ws.existsAsIs(`${directory}/${candidate}`) || candidate === folder)
      .map((candidate) => `${directory}/${candidate}`)
  );
}

/** A folder of `domain/` or `application/` in a module as 0.86 and 0.87 laid it out: `domain/<module>/aggregates`. */
function earlierPlace(module: string, folder: string): string {
  const [layer = '', ...rest] = folder.split('/');

  return EARLIER_MODULE_LAYERS.includes(layer) ? [layer, module, ...rest].join('/') : folder;
}
