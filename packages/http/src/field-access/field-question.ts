import type { Actor } from '@ddd-ts-kit/kernel';
import type { FieldRequirement } from './field-requirement';

/** What a decider is asked: whether the actor meets a requirement of a field, or of the form of a route. */
export interface FieldQuestion {
  readonly actor: Actor;
  readonly requirement: FieldRequirement;
  /** The element the requirement is asked about; `undefined` for none. */
  readonly subject: unknown;
  /** Facts beside the actor and the element, as `@Requires(..., { context })` gives a use case. */
  readonly context?: Readonly<Record<string, unknown>>;
  /**
   * Whether the decision is an act to keep in the audit trail: a field set in a body, the form of
   * a use case opened. A field shown or left out of an answer or a form only shapes it, and the
   * decision about it is not recorded.
   */
  readonly recorded: boolean;
}
