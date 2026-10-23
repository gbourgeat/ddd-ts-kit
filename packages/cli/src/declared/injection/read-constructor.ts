import type { SourceFile } from '../../check/model/source-file';

/** The constructor a class is built by: its own, or the nearest one it inherits inside the project. */
export interface ReadConstructor {
  /** The source that writes it: its parameter types are resolved through the imports of that file. */
  readonly file: SourceFile;
  readonly line: number;
  /** The blanked text of each parameter. */
  readonly parameters: readonly string[];
}
