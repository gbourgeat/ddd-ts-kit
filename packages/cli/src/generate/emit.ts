import type { RenderContext } from '../templating';
import { rendered } from './rendered';
import type { Scope } from './scope';

/** One generated file: the template it comes from and its path inside the context. */
export type Output = readonly [template: string, target: string];

/** Renders templates to paths relative to the context directory; says for each one whether it was written, not kept. */
export function emit(scope: Scope, context: RenderContext, outputs: readonly Output[]): readonly boolean[] {
  return outputs.map(([template, target]) =>
    scope.ws.create(`${scope.dir}/${target}`, rendered(scope, template, context)),
  );
}
