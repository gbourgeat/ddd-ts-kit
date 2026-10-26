import type { Schema } from '@ddd-ts-kit/validation';

/** The one answer of a controller when its use case succeeds. */
export interface ControllerResponse {
  readonly status: number;
  /** Left out, `The answer.` with a body and `Done.` without. */
  readonly description?: string;
  /** Left out, the controller answers no body and `handle` returns nothing. */
  readonly body?: Schema<unknown>;
  /**
   * The headers the answer carries, each with what it holds: `{ Location: 'The URL of the incident.' }`.
   * The contract lists them, and `handle` then returns `{ body, headers }` (`{ headers }` with no
   * body) with every one of them written.
   */
  readonly headers?: Readonly<Record<string, string>>;
}
