import type { RenderContext } from '../templating';
import { applyWiring } from './apply-wiring';
import type { Scope } from './scope';
import { wirings } from './wirings';

/**
 * Registers a new element where the wiring of the project is written. A kind says what each
 * place receives in `<kind>/<target>.<family>.tpl`; a kind written `<kind>/<variant>` in
 * `<kind>/<variant>.<target>.<family>.tpl`. Targets: `wiring` is the module file of the context
 * (explicit and manual families), `routes` the list of its routes (both styles on tsyringe),
 * `platform` and `platform-test` the two modules of the platform that bind what a declaration
 * cannot say.
 */
export function wire(scope: Scope, kind: string, context: RenderContext): void {
  for (const { file, wiring } of wirings(scope, kind, context)) {
    applyWiring(scope.ws, file, wiring);
  }
}
