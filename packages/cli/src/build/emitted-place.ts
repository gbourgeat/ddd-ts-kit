import type { AliasRoot, BuildLayout } from '../alias';

/** Where the compiler wrote, and what it wrote there. */
export interface EmittedPlace {
  readonly roots: readonly AliasRoot[];
  readonly layout: BuildLayout;
  /** What an alias specifier ends with in the sources: `.js`, or nothing. */
  readonly suffix: string;
  /** Whether a path, given from the project root, is a file. */
  readonly isFile: (file: string) => boolean;
}
