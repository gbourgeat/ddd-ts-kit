import { MODULE_LAYERS, MODULE_TEST_FOLDERS, SHARED_FOLDER, SHARED_FOLDERS, TEST_FOLDER } from './module-layers';

/** A path relative to its context, split into the module it sits in and the path it would have without modules. */
export interface ModuleSplit {
  readonly module: string | undefined;
  readonly path: string;
  /** True when the file sits under `shared/`, the folder of what belongs to no module: it then has no module. */
  readonly shared?: boolean;
}

/**
 * Reads the module of a path relative to its context, among the modules of the model the config
 * declares (`declaredModules`): `calendars/domain/aggregates/calendar.aggregate.ts` is
 * `domain/aggregates/calendar.aggregate.ts` of the module `calendars`, and
 * `test/unit/calendars/calendar.aggregate.spec.ts` is `test/unit/calendar.aggregate.spec.ts` of it,
 * as is `calendars/test/unit/calendar.aggregate.spec.ts`, in the test folder of the module.
 * In a context that declares modules, `shared/infrastructure/persistence/scheduling.schema.ts` is
 * `infrastructure/persistence/scheduling.schema.ts` of no module, and said so (`shared`).
 * A folder the config does not declare is no module: `tree/closed` reports it, and no tool reads it
 * as one. The folder of the module itself (`calendars`) is the module with an empty path. A path
 * already read without its module (`pathInContext`) is given no module.
 */
export function moduleSplit(file: string, modules: readonly string[]): ModuleSplit {
  const parts = file.split('/');

  return (
    inFolderOfModule(parts, modules) ??
    inSharedFolder(parts, modules) ??
    inTestFolder(parts, modules) ?? { module: undefined, path: file }
  );
}

/** `<module>/<layer>/...` and `<module>/test/...`, or the folder of the module itself. */
function inFolderOfModule(
  [first = '', second, ...rest]: readonly string[],
  modules: readonly string[],
): ModuleSplit | undefined {
  if (!modules.includes(first) || (second !== undefined && !MODULE_LAYERS.includes(second) && second !== TEST_FOLDER)) {
    return undefined;
  }

  return { module: first, path: second === undefined ? '' : [second, ...rest].join('/') };
}

/** `shared/<infrastructure|presentation|test>/...`, in a context divided into modules. */
function inSharedFolder(
  [first, second = '', ...rest]: readonly string[],
  modules: readonly string[],
): ModuleSplit | undefined {
  return modules.length > 0 && first === SHARED_FOLDER && SHARED_FOLDERS.includes(second)
    ? { module: undefined, path: [second, ...rest].join('/'), shared: true }
    : undefined;
}

/** `test/<unit|integration>/<module>/...`. */
function inTestFolder(
  [first, second = '', module = '', ...below]: readonly string[],
  modules: readonly string[],
): ModuleSplit | undefined {
  return first === TEST_FOLDER && MODULE_TEST_FOLDERS.includes(second) && modules.includes(module)
    ? { module, path: [TEST_FOLDER, second, ...below].join('/') }
    : undefined;
}
