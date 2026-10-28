import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { wiringFilesOf } from './wiring-files-of';

/** What the module files of a context register, read as one text: the ones that do not exist read as nothing. */
export function wiringTextOf(ws: Workspace, tree: ContextTree, context: string): string {
  return wiringFilesOf(tree, context)
    .map((file) => ws.read(file) ?? '')
    .join('\n');
}
