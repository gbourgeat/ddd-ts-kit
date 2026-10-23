import type { FieldHint } from './field-hint';
import type { FormGroupHint } from './form-group-hint';
import type { FormRequirement } from './form-requirement';

/**
 * What a route adds to its request schema to be described as a form: `form` of `@Controller` or
 * of `defineRoute`. Everything is optional: `form: {}` describes the body as it is, one field per
 * property in the order of the schema.
 */
export interface FormHints {
  /** The groups of the form in order; a field named in no group comes after them, in the order of the schema. */
  readonly groups?: readonly FormGroupHint[];
  readonly fields?: Readonly<Record<string, FieldHint | undefined>>;
  /** What the caller needs to be given the form, the permission of the use case; absent, whoever may call the route. */
  readonly requires?: FormRequirement;
}
