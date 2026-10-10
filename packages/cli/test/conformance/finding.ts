/** What one analyzer says of one file, in the vocabulary of that analyzer. */
export interface Finding {
  readonly rule: string;
  readonly file: string;
  readonly message: string;
}
