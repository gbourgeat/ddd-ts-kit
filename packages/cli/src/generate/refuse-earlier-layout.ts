import { CliError } from '../cli-error';
import type { Config } from '../config';
import { declaredModules, EARLIER_MODULE_LAYERS } from '../model-modules';
import type { Workspace } from '../workspace';
import { filesUnder } from './files-under';

/**
 * A context whose modules are still where 0.86 put them (`domain/<module>/`) is moved before a
 * generator or `move-to-module` writes in it: written in the layout of today, its new files would
 * sit apart from those of their module.
 */
export function refuseEarlierLayout(ws: Workspace, config: Config, context: string | undefined): void {
  const earlier = (context === undefined ? [] : declaredModules(config, context)).filter((module) =>
    EARLIER_MODULE_LAYERS.some(
      (layer) => filesUnder(ws, `${config.contextsDir}/${context}/${layer}/${module}`).length > 0,
    ),
  );

  if (earlier.length > 0) {
    throw new CliError(
      `The context "${context}" holds its modules where 0.86 put them (${earlier.map((module) => `domain/${module}/`).join(', ')}): a module now holds its layers, ${earlier[0]}/domain/, ${earlier[0]}/application/...`,
      `Run \`npx ddd-ts-kit context-layout ${context}\`, which moves each module with its adapters, routes and specs and every import of them, commit, then generate again.`,
    );
  }
}
