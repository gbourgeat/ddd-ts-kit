import type { Config } from '../config';
import type { Workspace } from '../workspace';
import type { ContextFacts } from './context-facts';
import { readContext } from './read-context';

/** Every context of the config or of the disk, by name. */
export function readContexts(ws: Workspace, config: Config): ContextFacts[] {
  const names = [...new Set([...Object.keys(config.contexts), ...ws.directories(config.contextsDir)])].sort();

  return names.map((name) => readContext(ws, config, name));
}
