import path from 'node:path';
import { affectedContexts } from './affected-contexts.js';
import { contextsIn } from './contexts-in.js';
import { governedSettings } from './governed-settings.js';

/**
 * The directories of the contexts a partial run leaves out, from the root of the project and
 * ending in `/`: every context that `DDD_TS_KIT_AFFECTED` does not name. Empty for a run of
 * everything. The runner config excludes their specs; what lives outside the contexts always runs.
 *
 *     // vitest.config.ts
 *     const NOT_AFFECTED = unaffectedContexts().map((directory) => `${directory}**`);
 */
export function unaffectedContexts(root: string = process.cwd()): string[] {
  const affected = affectedContexts();

  if (affected === undefined) {
    return [];
  }

  const { contextsDir } = governedSettings(root);

  return contextsIn(path.join(root, contextsDir))
    .filter((context) => !affected.includes(context))
    .map((context) => `${contextsDir}/${context}/`);
}
