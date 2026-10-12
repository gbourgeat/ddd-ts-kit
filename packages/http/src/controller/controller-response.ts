import type { Schema } from '@ddd-ts-kit/validation';

/** The one answer of a controller when its use case succeeds. */
export interface ControllerResponse {
  readonly status: number;
  /** Left out, `The answer.` with a body and `Done.` without. */
  readonly description?: string;
  /** Left out, the controller answers no body and `handle` returns nothing. */
  readonly body?: Schema<unknown>;
}
