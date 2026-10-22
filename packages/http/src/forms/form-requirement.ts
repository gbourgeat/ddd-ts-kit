import type { Actor } from '@ddd-ts-kit/kernel';
import type { FieldRequirement } from '../field-access/field-requirement';

/** How the form of a route asks its requirement about the values it is asked with. */
interface FormAsking<Values> {
  /** The element the requirement is asked about, as `resource` of `@Requires`; absent, none. */
  subject?(values: Values): unknown;

  /** Facts beside the actor and the element, as `context` of `@Requires`: who books for whom. */
  context?(values: Values, actor: Actor): Readonly<Record<string, unknown>>;
}

/**
 * What a caller needs to be given the form of a route: the permission of the use case it
 * describes, asked as its `@Requires` asks it, from the values the form is asked with, or a
 * policy. Refused, the form is answered 403, so that only who may run the use case reads which
 * fields it holds for them.
 */
export type FormRequirement<Values = unknown> = FieldRequirement & FormAsking<Values>;
