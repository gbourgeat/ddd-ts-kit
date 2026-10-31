import { declaredModules, moduleSplit } from '../model-modules';
import { filesUnder } from './files-under';
import type { Scope } from './scope';

/**
 * Every file of the context, named as the generators read it: without the module of the model that
 * holds it (`invoicing/application/commands/...` is `application/commands/...`), which the workspace
 * resolves to the file where it is.
 */
export function filesWithoutModules(scope: Scope): string[] {
  const modules = declaredModules(scope.config, scope.context.kebab);

  return [...new Set(filesUnder(scope.ws, scope.dir).map((file) => moduleSplit(file, modules).path))];
}
