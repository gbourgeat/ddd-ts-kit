import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { foldersOfContext } from './folders-of-context';
import { intoModule } from './into-module';
import { SHARED_FOLDER, SHARED_FOLDERS } from './module-layers';

/**
 * Every folder of a context that plays one role, by its path from the project root: the folder
 * of the context itself (`domain/aggregates`), the same folder in each module of its model
 * (`calendars/domain/aggregates`, `calendars/test/unit` for a folder of the tests), and in `shared/` when
 * the context is divided into modules (`shared/infrastructure/persistence`). A reader that lists a
 * role goes through here, so a file moved into a module is never lost from what the kit writes
 * about its context.
 */
export function roleFoldersOf(ws: Workspace, { directory, modules }: ContextTree, folder: string): string[] {
  const placed = foldersOfContext(modules)
    .flatMap((holder) => (holder === SHARED_FOLDER ? inShared(folder) : inModule(holder, folder)))
    .filter((candidate) => candidate !== folder);

  return (
    [folder, ...placed]
      // A folder a move is filling is planned before it is on disk.
      .filter((candidate) => ws.existsAsIs(`${directory}/${candidate}`) || candidate === folder)
      .map((candidate) => `${directory}/${candidate}`)
  );
}

/** Where a module holds the folder. */
function inModule(module: string, folder: string): string[] {
  return [intoModule(module, folder)];
}

/** The folder in `shared/`, which holds no folder of `domain/` nor of `application/`. */
function inShared(folder: string): string[] {
  return SHARED_FOLDERS.includes(topOf(folder)) ? [`${SHARED_FOLDER}/${folder}`] : [];
}

function topOf(folder: string): string {
  return folder.split('/')[0] ?? '';
}
