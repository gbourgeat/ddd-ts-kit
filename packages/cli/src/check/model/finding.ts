/** What a rule found in one file, before it is given a rule id and a severity. */
export interface Finding {
  readonly line: number;
  readonly message: string;
  readonly fix: string;
}
