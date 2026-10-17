/** The names and the files of the code at one moment: a ref of the trunk, or the working tree. */
export interface NameIndex {
  /** Each name declared in a source, or given by the name of a file, with the files that give it. */
  readonly names: ReadonlyMap<string, readonly string[]>;
  /** Every file under the source root, relative to the project root. */
  readonly files: ReadonlySet<string>;
}
