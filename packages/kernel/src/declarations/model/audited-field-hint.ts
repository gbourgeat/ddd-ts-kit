/** A field of a message that goes into its audit entry, in the clear or as a keyed hash. */
export type AuditedFieldHint<Name extends string = string> = Name | { readonly field: Name; readonly masked: true };
