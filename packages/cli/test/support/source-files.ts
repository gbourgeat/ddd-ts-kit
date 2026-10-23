import { read, walk } from '../helpers';

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/** The TypeScript files of a generated project under the given directories, with their text. */
export function sourceFiles(root: string, ...directories: readonly string[]): SourceFile[] {
  return walk(root)
    .filter(
      (file) =>
        file.endsWith('.ts') && directories.some((directory) => file.startsWith(`${directory}/`) || file === directory),
    )
    .map((file) => ({ path: file, text: read(root, file) }));
}
