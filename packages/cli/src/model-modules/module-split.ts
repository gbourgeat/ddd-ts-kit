import { isRoleFolder } from './is-role-folder';
import { MODULE_LAYERS } from './module-layers';

/** A path relative to its context, split into the module it sits in and the path it would have without modules. */
export interface ModuleSplit {
  readonly module: string | undefined;
  readonly path: string;
}

/**
 * Reads the module of a path relative to its context, among the modules of the model the config
 * declares (`declaredModules`): `domain/calendars/aggregates/calendar.aggregate.ts` is
 * `domain/aggregates/calendar.aggregate.ts` of the module `calendars`. A folder the config does
 * not declare is no module: `tree/closed` reports it, and no tool reads it as one. The folder of
 * the module itself (`domain/calendars`) is the layer, in the module. A path already read without
 * its module (`pathInContext`) is given no module.
 */
export function moduleSplit(file: string, modules: readonly string[]): ModuleSplit {
  const [layer = '', module, ...below] = file.split('/');

  if (
    !MODULE_LAYERS.includes(layer) ||
    module === undefined ||
    isRoleFolder(layer, module) ||
    !modules.includes(module)
  ) {
    return { module: undefined, path: file };
  }

  return { module, path: [layer, ...below].join('/') };
}
