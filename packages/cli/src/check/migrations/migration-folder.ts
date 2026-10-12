/** One migration: the name that orders it, without extension, and the file that holds it, from the project root. */
export interface Migration {
  readonly name: string;
  readonly file: string;
}

/** The migrations a project keeps in one folder. */
export interface MigrationFolder {
  /** Relative to the project root, POSIX separators. */
  readonly folder: string;
  /** In the order the migration tool applies them: by name. */
  readonly migrations: readonly Migration[];
}
