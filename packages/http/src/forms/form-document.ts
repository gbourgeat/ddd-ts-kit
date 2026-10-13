import type { FormDescription } from './form-description.js';
import type { JsonForm } from './json-form.js';

/** The whole form of a route, as a caller allowed every field gets it: what the documentation shows. */
export interface FormDocument {
  readonly operation: string;
  readonly jsonForms: JsonForm;
  readonly blocks: FormDescription;
}
