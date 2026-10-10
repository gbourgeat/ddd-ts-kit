/** A value stored as a keyed hash: equality can be checked, the value cannot be read back. */
export interface MaskedValue {
  readonly masked: string;
}
