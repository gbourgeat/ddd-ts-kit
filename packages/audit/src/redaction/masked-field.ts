/** A declared field whose value is stored as a keyed hash: for personal data. */
export interface MaskedField<Name extends string = string> {
  readonly field: Name;
  readonly masked: true;
}
