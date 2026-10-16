/** What one script of the project answered: whether it passed, and the end of what it printed when it did not. */
export interface ScriptRun {
  readonly ok: boolean;
  readonly output: string;
}
