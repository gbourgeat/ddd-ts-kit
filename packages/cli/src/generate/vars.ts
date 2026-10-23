import type { RenderContext, RenderValue } from '../templating';
import { contextVars } from './context-vars';
import type { Scope } from './scope';

/** The variables of the stack and of the context, plus the ones of the kind. */
export function vars(scope: Scope, extra: Record<string, RenderValue>): RenderContext {
  return { ...contextVars(scope.config, scope.context), ...extra };
}
