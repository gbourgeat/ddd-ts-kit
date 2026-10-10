import type { RenderContext, RenderValue } from '../templating/index.js';
import { contextVars } from './context-vars.js';
import type { Scope } from './scope.js';

/** The variables of the stack and of the context, plus the ones of the kind. */
export function vars(scope: Scope, extra: Record<string, RenderValue>): RenderContext {
  return { ...contextVars(scope.config, scope.context), ...extra };
}
