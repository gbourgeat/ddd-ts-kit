import type { RenderContext } from '../templating';
import { rendered } from './rendered';
import type { Scope } from './scope';

/** One generated file: the template it comes from and its path inside the context. */
export type Output = readonly [template: string, target: string];

/** Renders templates to paths relative to the context directory. */
export function emit(scope: Scope, context: RenderContext, outputs: readonly Output[]): void {
  for (const [template, target] of outputs) {
    scope.ws.create(`${scope.dir}/${target}`, rendered(scope, template, context));
  }
}
