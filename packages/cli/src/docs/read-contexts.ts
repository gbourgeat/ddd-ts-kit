import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import type { ContextFacts } from './context-facts.js';
import { readContext } from './read-context.js';

/** Every context of the config or of the disk, by name. */
export function readContexts(ws: Workspace, config: Config): ContextFacts[] {
  const names = [...new Set([...Object.keys(config.contexts), ...ws.directories(config.contextsDir)])].sort();

  return names.map((name) => readContext(ws, config, name));
}
