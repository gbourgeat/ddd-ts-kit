/** A read model store of a context that keeps its rows in a table of one of the four ORM. */
export interface ReadModelStore {
  readonly context: string;
  /** Its file, from the root of the project. */
  readonly file: string;
  readonly name: string;
  readonly line: number;
  /**
   * Whether the list can build it as it is: an exported class that is not generic, whose own
   * constructor is the generated one, `(database)` or `(database, scope)`.
   */
  readonly listable: boolean;
}
