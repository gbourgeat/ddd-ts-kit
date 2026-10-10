/** Something for the team to look at in a file a command changed: reported next to the `TODO(domain)` of the files it created. */
export interface NextStep {
  readonly file: string;
  /** Text of the line the step points at; the first line of the file when it is not found. */
  readonly anchor: string;
  readonly text: string;
}
