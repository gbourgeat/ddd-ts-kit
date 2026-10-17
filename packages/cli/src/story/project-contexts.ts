import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';

/** The contexts of the project: those the config declares and the directories of the contexts folder. */
export function projectContexts(ws: Workspace, config: Config): string[] {
  return [...new Set([...Object.keys(config.contexts), ...ws.directories(config.contextsDir)])].sort();
}
