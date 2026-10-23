import type { Config } from '../../config';
import type { Layer } from '../model/layer';
import type { Location } from '../model/location';
import { earlierPlaceOf } from '../../context-files';
import { declaredModules, moduleSplit } from '../../model-modules';
import { isUnder } from './is-under';

const LAYERS: readonly Layer[] = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'published-language',
  'test',
];

/** Classifies a file by its path alone. */
export function locate(config: Config, file: string): Location {
  if (isUnder(file, config.contextsDir)) {
    return locateInContexts(config, file.slice(config.contextsDir.length + 1));
  }

  if (isUnder(file, config.sharedKernelDir)) {
    return { area: 'shared-kernel' };
  }

  if (isUnder(file, config.platformDir)) {
    return { area: 'platform' };
  }

  if (file === `${config.sourceRoot}/main.ts`) {
    return { area: 'main' };
  }

  return { area: 'other' };
}

function locateInContexts(config: Config, relative: string): Location {
  const [context, first, ...rest] = relative.split('/');

  if (context === undefined || context === '' || first === undefined) {
    return { area: 'other' };
  }

  if (rest.length === 0) {
    return locateAtContextRoot(context, first);
  }

  const layer = LAYERS.find((candidate) => candidate === first) ?? 'root';
  const inModule = moduleLocation(config, { context, layer, rest });

  if (inModule !== undefined) {
    return inModule;
  }

  return { area: 'context', context, layer, inside: layer === 'root' ? [first, ...rest] : rest };
}

interface Placed {
  readonly context: string;
  readonly layer: Layer;
  /** The path below the layer. */
  readonly rest: readonly string[];
}

/**
 * A module of the model is one folder level under domain/ and application/: left out, the rest of
 * the path is what it would be without modules, so every role keeps its place.
 */
function moduleLocation(config: Config, { context, layer, rest }: Placed): Location | undefined {
  const { module, path } = moduleSplit([layer, ...rest].join('/'), declaredModules(config, context));

  return module === undefined
    ? undefined
    : { area: 'context', context, layer, inside: path.split('/').slice(1), module };
}

function locateAtContextRoot(context: string, entry: string): Location {
  if (entry === `${context}.module.ts`) {
    return { area: 'context', context, layer: 'module', inside: [] };
  }

  // The code list and the permission set sit at the root, and are read as they were in their role folder;
  // an import names them without an extension, or with `.js`.
  const [layer, ...inside] = earlierPlaceOf(context, `${entry.replace(/\.(?:js|ts)$/, '')}.ts`)?.split('/') ?? [];
  const placed = LAYERS.find((candidate) => candidate === layer);

  if (placed !== undefined) {
    return { area: 'context', context, layer: placed, inside };
  }

  // A directory import (`../billing/published-language`) names the layer without a file.
  const named = LAYERS.find((candidate) => candidate === entry.replace(/\.ts$/, ''));

  return { area: 'context', context, layer: named ?? 'root', inside: [] };
}
