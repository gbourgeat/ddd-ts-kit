import { SHARED_FOLDER } from './module-layers';

/**
 * Every folder at the root of a context that holds files of its layers besides the layers
 * themselves: the modules of its model, then `shared/` for what belongs to none of them. A
 * context that declares no module has neither. A reader of paths goes through here;
 * `declaredModules` stays the modules of the model, which `shared` is not.
 */
export function foldersOfContext(modules: readonly string[]): string[] {
  return modules.length === 0 ? [] : [...modules, SHARED_FOLDER];
}
