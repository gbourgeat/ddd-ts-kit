import type { Config } from '../config';
import { declaredModules } from './declared-modules';

/** Where the files of a context are read: its directory from the project root, and the modules of its model. */
export interface ContextTree {
  readonly directory: string;
  readonly modules: readonly string[];
}

/** The tree of a context as the config places and divides it. */
export function treeOf(config: Config, context: string): ContextTree {
  return { directory: `${config.contextsDir}/${context}`, modules: declaredModules(config, context) };
}
