import { isRoleFolder } from './is-role-folder.js';
import { MODULE_LAYERS } from './module-layers.js';

/** A path relative to its context, split into the module it sits in and the path it would have without modules. */
export interface ModuleSplit {
  readonly module: string | undefined;
  readonly path: string;
}

/**
 * Reads the module of a path relative to its context by structure: a folder directly under
 * `domain/` or `application/` that no role owns. `domain/calendars/aggregates/calendar.aggregate.ts`
 * is `domain/aggregates/calendar.aggregate.ts` of the module `calendars`.
 */
export function moduleSplit(file: string): ModuleSplit {
  const [layer = '', module, ...below] = file.split('/');

  if (!MODULE_LAYERS.includes(layer) || module === undefined || below.length === 0 || isRoleFolder(layer, module)) {
    return { module: undefined, path: file };
  }

  return { module, path: [layer, ...below].join('/') };
}
