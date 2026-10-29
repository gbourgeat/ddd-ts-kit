/** A place a command points the team at, as its report gives it: where, and the first words of what to decide there. */
export interface TodoPlace {
  readonly file: string;
  readonly line: number;
  /** The first words of the marker at that line, whose whole sentence the file holds. */
  readonly gist: string;
  /** The whole sentence of a step on a line the command changed, which no file holds; absent for a marker. */
  readonly text?: string;
}
