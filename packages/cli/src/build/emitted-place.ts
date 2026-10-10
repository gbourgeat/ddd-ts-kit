import type { AliasRoot, BuildLayout } from '../alias/index.js';

/** Where the compiler wrote, and what it wrote there. */
export interface EmittedPlace {
  readonly roots: readonly AliasRoot[];
  readonly layout: BuildLayout;
  /** Whether a path, given from the project root, is a file. */
  readonly isFile: (file: string) => boolean;
}
