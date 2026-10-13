/** A value of a closed vocabulary of the project: where it is declared, and how code reads it instead of the string. */
export interface DeclaredValue {
  readonly value: string;
  /** `AppointmentStatus.NoShow`, `billingPermissions['invoice.issue'].id`. */
  readonly written: string;
  /** The name of the vocabulary or of the permission set. */
  readonly vocabulary: string;
  readonly file: string;
  /** Who reads it: `everywhere` for a permission id; the context that declares it; or the platform, read by the platform and by the presentation of the contexts. */
  readonly readBy: { readonly context: string } | 'everywhere' | 'platform';
}
