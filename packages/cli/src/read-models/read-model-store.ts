/** A read model store of a context that keeps its rows in a table of one of the four ORM. */
export interface ReadModelStore {
  readonly context: string;
  /** Its file, from the root of the project. */
  readonly file: string;
  readonly name: string;
  readonly line: number;
  /** The class it extends, as its file names it. */
  readonly base: string;
  /**
   * Why the list cannot build it as it is, in a few words; none for an exported class that is not
   * generic, whose own constructor is the one of a generated store.
   */
  readonly obstacle: string | undefined;
}
