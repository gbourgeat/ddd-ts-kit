/** A group of fields of a form, in order, which may hold groups of its own. */
export interface FormGroupHint {
  /** Gives the translation key of its label, `<operationId>.<name>`. */
  readonly name: string;
  readonly fields: readonly string[];
  readonly groups?: readonly FormGroupHint[];
}
