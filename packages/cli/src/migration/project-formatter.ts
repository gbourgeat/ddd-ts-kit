/** The formatter the `format` script of a project runs, found installed, run on given paths by the same node. */
export interface ProjectFormatter {
  readonly name: 'Biome' | 'Prettier';
  /** The entry file of its command line, under node_modules. */
  readonly bin: string;
  /** What precedes the paths: write in place, and pass over a path its configuration ignores. */
  readonly args: readonly string[];
}
