import type { ControllerRequest } from './controller-request';
import type { ControllerResult } from './controller-result';
import type { ControllerSpec } from './controller-spec';

/**
 * The shape `@Controller(spec)` requires of the class it decorates. `handle` is a function
 * property on purpose: its parameter is then compared strictly, so a controller that reads a
 * part its declaration does not produce, or returns another body or leaves a declared header
 * out, does not compile.
 */
export interface HttpController<Spec extends ControllerSpec = ControllerSpec> {
  readonly handle: [ControllerResult<Spec>] extends [undefined]
    ? (request: ControllerRequest<Spec>) => void | Promise<void>
    : (request: ControllerRequest<Spec>) => ControllerResult<Spec> | Promise<ControllerResult<Spec>>;
}
