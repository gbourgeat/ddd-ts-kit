import type { Actor } from '@ddd-ts-kit/kernel';
import type { HandlerInput } from '../route/handler-input.js';
import type { ControllerSpec } from './controller-spec.js';

/**
 * What `handle` receives for a given declaration: each part has the type its schema produces,
 * and the actor is the one of the execution context of the request.
 */
export type ControllerRequest<Spec extends ControllerSpec = ControllerSpec> = HandlerInput<Spec> & {
  readonly actor: Actor;
};
