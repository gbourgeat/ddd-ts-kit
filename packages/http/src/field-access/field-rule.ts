import type { FieldRequirement } from './field-requirement.js';

/** Who may see and who may set one field of a schema. */
export interface FieldRule<Container = unknown> {
  /** Who sees the field in an answer, in every representation; absent, whoever may call the route. */
  readonly read?: FieldRequirement;
  /** Who may set it in a request body, and finds it editable in a form; absent, whoever may see it. */
  readonly write?: FieldRequirement;

  /** The element the requirement is asked about, from the object that holds the field; absent, none. */
  subject?(container: Container): unknown;
}
