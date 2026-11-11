import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { foldersOfContext } from './folders-of-context';
import { intoModule } from './into-module';
import { EARLIER_MODULE_LAYERS, SHARED_FOLDER, SHARED_FOLDERS, TEST_FOLDER } from './module-layers';

/**
 * Every folder of a context that plays one role, by its path from the project root: the folder
 * of the context itself (`domain/aggregates`), the same folder in each module of its model
 * (`calendars/domain/aggregates`, or `domain/calendars/aggregates` as 0.86 and 0.87 laid it out;
 * `test/unit/calendars` and `calendars/test/unit` for a folder of the tests), and in `shared/` when
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

/** Where a module holds the folder today, where it holds its own tests, and where 0.86 and 0.87 put it, which context-layout moves. */
function inModule(module: string, folder: string): string[] {
  return [
    intoModule(module, folder),
    topOf(folder) === TEST_FOLDER ? `${module}/${folder}` : folder,
    earlierPlace(module, folder),
  ];
}

/** The folder in `shared/`, which holds no folder of `domain/` nor of `application/`. */
function inShared(folder: string): string[] {
  return SHARED_FOLDERS.includes(topOf(folder)) ? [`${SHARED_FOLDER}/${folder}`] : [];
}

function topOf(folder: string): string {
  return folder.split('/')[0] ?? '';
}

/** A folder of `domain/` or `application/` in a module as 0.86 and 0.87 laid it out: `domain/<module>/aggregates`. */
function earlierPlace(module: string, folder: string): string {
  const [layer = '', ...rest] = folder.split('/');

  return EARLIER_MODULE_LAYERS.includes(layer) ? [layer, module, ...rest].join('/') : folder;
}
