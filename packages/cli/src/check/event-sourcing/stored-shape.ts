/** What `readStoredShape` reads of the data type of a stored event. */
export interface StoredShape {
  readonly fingerprint: string;
  /** The type declares no member: its fingerprint is the one of nothing, which vouches for no shape. */
  readonly empty: boolean;
  /** The fingerprint 0.82.0 and earlier gave the same declaration, when it is another one: a type that holds type arguments. */
  readonly formerFingerprint: string | undefined;
  /** The named types the shape reaches that the file does not declare, in the order met. */
  readonly unresolved: readonly string[];
}
