import type { FormFormat } from './form-format';

/** What the request for a form says: the format it wants, and the values known in advance, by field. */
export interface FormQuery {
  readonly format: FormFormat;
  readonly values: Readonly<Record<string, unknown>>;
}
