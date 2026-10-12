import { specifierOf } from '../alias/index.js';
import type { Config } from '../config/index.js';
import { barrelFile, renderBarrel } from '../declared/index.js';
import type { Workspace } from '../workspace/index.js';
import { filesUnder } from './files-under.js';
import { isDeclared } from './is-declared.js';

/**
 * Rewrites the barrel of every declared context from its tree. Called at the end of every
 * `generate` and by `docs`: the barrel is derived, like the documentation, and
 * `declarations/barrel-current` reports one that was left behind.
 */
export function refreshBarrels(ws: Workspace, config: Config): void {
  if (!isDeclared(config) || config.stack.assembly !== 'barrel') {
    return;
  }

  for (const context of ws.directories(config.contextsDir)) {
    if (config.contexts[context] === undefined) {
      continue;
    }

    const directory = `${config.contextsDir}/${context}`;
    const file = `${directory}/${barrelFile(context)}`;
    const content = renderBarrel(filesUnder(ws, directory), (entry) => specifierOf(config, `${directory}/${entry}`));

    if (ws.exists(file)) {
      ws.update(file, content);
    } else {
      ws.create(file, content);
    }
  }
}
