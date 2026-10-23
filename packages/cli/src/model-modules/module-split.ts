import { isRoleFolder } from './is-role-folder';
import { EARLIER_MODULE_LAYERS, MODULE_LAYERS, MODULE_TEST_FOLDERS } from './module-layers';

/** A path relative to its context, split into the module it sits in and the path it would have without modules. */
export interface ModuleSplit {
  readonly module: string | undefined;
  readonly path: string;
  /** True when the module sits where 0.86 and 0.87 put it, under `domain/` or `application/`. */
  readonly earlier?: boolean;
}

/**
 * Reads the module of a path relative to its context, among the modules of the model the config
 * declares (`declaredModules`): `calendars/domain/aggregates/calendar.aggregate.ts` is
 * `domain/aggregates/calendar.aggregate.ts` of the module `calendars`, and
 * `test/unit/calendars/calendar.aggregate.spec.ts` is `test/unit/calendar.aggregate.spec.ts` of it.
 * The layout of 0.86 and 0.87, `domain/calendars/aggregates/...`, is read too, and said so (`earlier`). A
 * folder the config does not declare is no module: `tree/closed` reports it, and no tool reads it
 * as one. The folder of the module itself (`calendars`) is the module with an empty path. A path
 * already read without its module (`pathInContext`) is given no module.
 */
export function moduleSplit(file: string, modules: readonly string[]): ModuleSplit {
  const parts = file.split('/');

  return (
    inFolderOfModule(parts, modules) ??
    inTestFolder(parts, modules) ??
    inEarlierPlace(parts, modules) ?? { module: undefined, path: file }
  );
}

/** `<module>/<layer>/...`, or the folder of the module itself. */
function inFolderOfModule(
  [first = '', second, ...rest]: readonly string[],
  modules: readonly string[],
): ModuleSplit | undefined {
  if (!modules.includes(first) || (second !== undefined && !MODULE_LAYERS.includes(second))) {
    return undefined;
  }

  return { module: first, path: second === undefined ? '' : [second, ...rest].join('/') };
}

/** `test/<unit|integration>/<module>/...`. */
function inTestFolder(
  [first, second = '', module = '', ...below]: readonly string[],
  modules: readonly string[],
): ModuleSplit | undefined {
  return first === 'test' && MODULE_TEST_FOLDERS.includes(second) && modules.includes(module)
    ? { module, path: ['test', second, ...below].join('/') }
    : undefined;
}

/** `<domain|application>/<module>/...`, as 0.86 and 0.87 laid modules out. */
function inEarlierPlace(
  [first = '', second = '', ...rest]: readonly string[],
  modules: readonly string[],
): ModuleSplit | undefined {
  return EARLIER_MODULE_LAYERS.includes(first) && !isRoleFolder(first, second) && modules.includes(second)
    ? { module: second, path: [first, ...rest].join('/'), earlier: true }
    : undefined;
}
