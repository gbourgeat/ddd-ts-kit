/** A value of a closed vocabulary of the project, and how code reads it instead of the string. */
export interface DeclaredValue {
  /** `AppointmentStatus.NoShow`, `billingPermissions['invoice.issue']`. */
  readonly written: string;
  /** The name of the vocabulary or of the permission set. */
  readonly vocabulary: string;
  /** The declaring file, relative to the project root. */
  readonly file: string;
  /** Who reads it: `everywhere` for a permission id; the context that declares it; or the platform, read by the platform and by the presentation of the contexts. */
  readonly readBy: { readonly context: string } | 'everywhere' | 'platform';
}
