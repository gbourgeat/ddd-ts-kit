import type { FormDescription } from './form-description';
import type { JsonForm } from './json-form';

/** The whole form of a route, as a caller allowed every field gets it: what the documentation shows. */
export interface FormDocument {
  readonly operation: string;
  readonly jsonForms: JsonForm;
  readonly blocks: FormDescription;
}
