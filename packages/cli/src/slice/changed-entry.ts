/** One path `git status` reports: whether git already tracks it, or it is new. */
export interface ChangedEntry {
  readonly path: string;
  readonly tracked: boolean;
}
