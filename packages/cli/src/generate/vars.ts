import { aliasRoots, contextAlias, directoryAlias } from '../alias';
import type { RenderContext, RenderValue } from '../templating';
import { contextVars } from './context-vars';
import type { Scope } from './scope';
import { isSharedKernel } from './is-shared-kernel';

/** The variables of the stack and of the context, plus the ones of the kind. */
export function vars(scope: Scope, extra: Record<string, RenderValue>): RenderContext {
  return { ...contextVars(scope.config, scope.context, aliasOf(scope)), ...extra };
}

/** The alias the files of the scope are imported by: the shared kernel is not under the contexts. */
function aliasOf(scope: Scope): string {
  return isSharedKernel(scope)
    ? directoryAlias(aliasRoots(scope.config), scope.dir)
    : contextAlias(scope.config, scope.context.kebab);
}
