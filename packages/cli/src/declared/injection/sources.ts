import type { SourceFile } from '../../check/model/source-file';

/** The source at a path given from the project root, or undefined when no such file can be read. */
export type Sources = (file: string) => SourceFile | undefined;
