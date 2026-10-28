/** What a rule found in one file, before it is given a rule id and a severity. */
export interface Finding {
  readonly line: number;
  readonly message: string;
  readonly fix: string;
  /**
   * The other files this finding is repaired in, when it sits on a file that is not its cause (a
   * handler reported because the module file does not register it). `check --changed-since`
   * keeps the finding when one of them changed.
   */
  readonly subjects?: readonly string[];
}
