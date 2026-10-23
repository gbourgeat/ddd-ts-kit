import type { Schema } from '@ddd-ts-kit/validation';
import type { ControllerRequest } from './controller-request';
import type { ControllerSpec } from './controller-spec';

/**
 * The shape `@Controller(spec)` requires of the class it decorates. `handle` is a function
 * property on purpose: its parameter is then compared strictly, so a controller that reads a
 * part its declaration does not produce, or returns another body, does not compile.
 */
export interface HttpController<Spec extends ControllerSpec = ControllerSpec> {
  readonly handle: Spec['response'] extends { readonly body: Schema<infer Body> }
    ? (request: ControllerRequest<Spec>) => Body | Promise<Body>
    : (request: ControllerRequest<Spec>) => void | Promise<void>;
}
