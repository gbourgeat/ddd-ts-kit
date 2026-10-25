/** What the reader needs of the project: the text of a file, and the files below a directory. */
export interface ProjectFiles {
  read(file: string): string | undefined;
  under(directory: string): readonly string[];
}
