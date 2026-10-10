import type { Config } from '../../config/index.js';
import type { Layer } from '../model/layer.js';
import type { Location } from '../model/location.js';
import { isUnder } from './is-under.js';

const LAYERS: readonly Layer[] = ['domain', 'application', 'infrastructure', 'presentation', 'published-language', 'test'];

/** Classifies a file by its path alone. */
export function locate(config: Config, file: string): Location {
  if (isUnder(file, config.contextsDir)) return locateInContexts(file.slice(config.contextsDir.length + 1));
  if (isUnder(file, config.sharedKernelDir)) return { area: 'shared-kernel' };
  if (isUnder(file, config.platformDir)) return { area: 'platform' };
  if (file === `${config.sourceRoot}/main.ts`) return { area: 'main' };

  return { area: 'other' };
}

function locateInContexts(relative: string): Location {
  const [context, first, ...rest] = relative.split('/');

  if (context === undefined || context === '' || first === undefined) return { area: 'other' };
  if (rest.length === 0) return locateAtContextRoot(context, first);

  const layer = LAYERS.find((candidate) => candidate === first) ?? 'root';

  return { area: 'context', context, layer, inside: layer === 'root' ? [first, ...rest] : rest };
}

function locateAtContextRoot(context: string, entry: string): Location {
  if (entry === `${context}.module.ts`) return { area: 'context', context, layer: 'module', inside: [] };

  // A directory import (`../billing/published-language`) names the layer without a file.
  const named = LAYERS.find((candidate) => candidate === entry.replace(/\.ts$/, ''));

  return { area: 'context', context, layer: named ?? 'root', inside: [] };
}
