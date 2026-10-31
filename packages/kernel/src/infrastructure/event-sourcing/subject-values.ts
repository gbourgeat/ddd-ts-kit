/** What the data of one event holds of a subject: each value opened under its path, and the paths of those that do not decipher. */
export interface SubjectValues {
  readonly values: Readonly<Record<string, string>>;
  readonly unreadable: readonly string[];
}
