import type { ContextTree } from './context-tree';
import { moduleFileOf } from './module-file-of';

/** The module files of a context in the explicit style, from the project root: its own, then the one of each module of its model. */
export function wiringFilesOf({ directory, modules }: ContextTree, context: string): string[] {
  return [`${directory}/${context}.module.ts`, ...modules.map((module) => `${directory}/${moduleFileOf(module)}`)];
}
