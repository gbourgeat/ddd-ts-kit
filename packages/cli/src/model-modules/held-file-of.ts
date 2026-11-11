import { posix } from 'node:path';
import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { roleFoldersOf } from './role-folders-of';

/**
 * Where a file of a context is, from the project root, given as it is named without modules
 * (`presentation/http/billing.routes.ts`, `test/worlds/billing.world.ts`): at the level of the
 * context, in one of its modules or in `shared/`, the first that holds it. A file that is nowhere
 * yet is answered at the level of the context, where a reader finds nothing.
 */
export function heldFileOf(ws: Workspace, tree: ContextTree, file: string): string {
  const name = posix.basename(file);

  const [atTheContext, ...placed] = roleFoldersOf(ws, tree, posix.dirname(file));

  // A context divided into modules holds the file in a module or in shared/: one left at its level is read last.
  const held = [...placed, ...(atTheContext === undefined ? [] : [atTheContext])]
    .map((folder) => `${folder}/${name}`)
    .find((candidate) => ws.existsAsIs(candidate));

  return held ?? `${tree.directory}/${file}`;
}
