import type { Schema } from '@ddd-ts-kit/validation';
import type { ControllerSpec } from './controller-spec.js';

/** What `handle` returns for a given declaration: the body its response schema describes, or nothing. */
export type ControllerResult<Spec extends ControllerSpec = ControllerSpec> = Spec['response'] extends {
  readonly body: Schema<infer Body>;
}
  ? Body
  : undefined;
