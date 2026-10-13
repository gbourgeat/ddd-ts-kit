import type { FieldHint } from './field-hint.js';
import type { FormGroupHint } from './form-group-hint.js';
import type { FormHints } from './form-hints.js';

/** The hints of a form whose field names the compiler checks against the body of the route. */
export interface TypedFormHints<Body> {
  readonly groups?: readonly (FormGroupHint & { readonly fields: readonly (keyof Body & string)[] })[];
  readonly fields?: { readonly [Name in keyof Body & string]?: FieldHint };
}

/**
 * The hints of the form of a route, in `<use-case>.form.ts` next to its controller:
 * `export const bookAppointmentForm = defineForm<BookAppointmentBody>({ fields: { reason: { widget: 'textarea' } } })`.
 */
export function defineForm<Body>(hints: TypedFormHints<Body>): FormHints {
  return hints;
}
