import type { RenderContext } from '../templating';
import { applyWiring } from './apply-wiring';
import type { Registration } from './registration';
import type { Scope } from './scope';
import { wirings } from './wirings';

/**
 * Registers a new element where the wiring of the project is written. A kind says what each
 * place receives in `<kind>/<target>.<family>.tpl`; a kind written `<kind>/<variant>` in
 * `<kind>/<variant>.<target>.<family>.tpl`. Targets: `wiring` is the module file of the context
 * (explicit and manual families), `routes` the list of its routes (both styles on tsyringe),
 * `platform` and `platform-test` the two modules of the platform that bind what a declaration
 * cannot say. The module file is the one of the context, or, given `--module`, the
 * `<module>/<module>.module.ts` of that module of its model when it exists, or the one that holds
 * the line the registration needs (`Registration`, `wirings`).
 */
export function wire(scope: Scope, registration: string | Registration, context: RenderContext): void {
  const registered = typeof registration === 'string' ? { kind: registration } : registration;

  for (const { file, wiring } of wirings(scope, registered, context)) {
    applyWiring(scope.ws, file, wiring);
  }
}
