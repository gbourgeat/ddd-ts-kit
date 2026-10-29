/** A note of the reference: what a line of the usage cannot say about a command or a flag. */
export interface Note {
  /** The command or the flag it is about, as the reference prints it. */
  readonly name: string;
  /** The command whose help prints it: the command itself, or the command that takes the flag. */
  readonly command: string;
  /** Its text, in the lines the reference prints after the name. */
  readonly lines: readonly string[];
}
