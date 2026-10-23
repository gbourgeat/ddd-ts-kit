/** The files of a story in `docs/architecture/` and `test/acceptance/`. */
export interface StoryFiles {
  readonly story: string;
  readonly file: string;
  /** The design review, when the project has it. */
  readonly review?: string;
  readonly lock: string;
  readonly acceptance: string;
}
