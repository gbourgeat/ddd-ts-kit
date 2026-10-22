import type { FieldHint } from './field-hint';
import type { FormGroupHint } from './form-group-hint';
import type { FormHints } from './form-hints';
import type { FormRequirement } from './form-requirement';

/** The hints of a form whose field names the compiler checks against the body of the route. */
export interface TypedFormHints<Body> {
  readonly groups?: readonly (FormGroupHint & { readonly fields: readonly (keyof Body & string)[] })[];
  readonly fields?: { readonly [Name in keyof Body & string]?: FieldHint };
  readonly requires?: FormRequirement<Partial<Body>>;
}

/**
 * The hints of the form of a route, next to the schemas of its controller:
 * `const form = defineForm<Infer<typeof body>>({ fields: { reason: { widget: 'textarea' } } })`.
 */
export function defineForm<Body>(hints: TypedFormHints<Body>): FormHints {
  return hints;
}
