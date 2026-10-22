import type { FormCondition } from './form-condition';
import type { Widget } from './widget';

/** What the request schema cannot say about one field of a form: how it is entered and when it applies. */
export interface FieldHint {
  /** Left out, taken from the schema: `select` for an enumeration, `datetime` for a `date-time`, `checkbox` for a boolean. */
  readonly widget?: Widget;
  /** The values a field may take when the schema does not list them, a closed vocabulary: `Object.values(AppointmentKind)`. */
  readonly options?: readonly (string | number | boolean)[];
  /** The operation id of a `GET` route whose items are the options: the form names its path. */
  readonly lookup?: string;
  /** Shown only when the condition holds. */
  readonly visibleWhen?: FormCondition;
  /** Required only when the condition holds; the server still decides with its own rules. */
  readonly requiredWhen?: FormCondition;
  /** A translation key of its own; left out, `<operationId>.<field>`. */
  readonly label?: string;
}
