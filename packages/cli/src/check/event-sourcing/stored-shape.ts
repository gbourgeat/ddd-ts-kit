/** What `readStoredShape` reads of the data type of a stored event. */
export interface StoredShape {
  readonly fingerprint: string;
  /** The named types the shape reaches that the file does not declare, in the order met. */
  readonly unresolved: readonly string[];
}
