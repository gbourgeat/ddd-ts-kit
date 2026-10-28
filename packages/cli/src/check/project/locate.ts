import type { Config } from '../../config';
import type { Layer } from '../model/layer';
import type { Location } from '../model/location';
import { earlierPlaceOf } from '../../context-files';
import { declaredModules, moduleOfModuleFile, moduleSplit } from '../../model-modules';
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

  // A dot folder is a tool's, never a context.
  if (context === undefined || context === '' || context.startsWith('.') || first === undefined) {
    return { area: 'other' };
  }

  if (rest.length === 0) {
    return locateAtContextRoot(context, first);
  }

  const inModule = moduleLocation(config, context, [first, ...rest]);

  if (inModule !== undefined) {
    return inModule;
  }

  const layer = LAYERS.find((candidate) => candidate === first) ?? 'root';

  return { area: 'context', context, layer, inside: layer === 'root' ? [first, ...rest] : rest };
}

/**
 * A module of the model is one folder of the context holding its layers, and one folder of the
 * test folders of its specs: left out, the rest of the path is what it would be without modules,
 * so every role keeps its place. At its root, `<module>.module.ts` registers what the module holds
 * in the explicit style: a part of the module file of the context, read as one.
 */
function moduleLocation(config: Config, context: string, parts: readonly string[]): Location | undefined {
  const modules = declaredModules(config, context);
  const wiring = moduleOfModuleFile(parts.join('/'), modules);

  if (wiring !== undefined) {
    return { area: 'context', context, layer: 'module', inside: [], module: wiring };
  }

  const { module, path } = moduleSplit(parts.join('/'), modules);
  const [first, ...inside] = path.split('/');
  const layer = LAYERS.find((candidate) => candidate === first);

  return module === undefined || layer === undefined ? undefined : { area: 'context', context, layer, inside, module };
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
