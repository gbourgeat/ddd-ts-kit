/** One kind of file a command of the kit writes, which a reviewer does not review. */
export interface GeneratedFileKind {
  /** How the `## Do not report` of REVIEW.md names it. */
  readonly label: string;
  /** Whether a path, relative to the project root, is of that kind. */
  readonly covers: (file: string) => boolean;
  /**
   * Set when the kit writes only some sections of such a file, between `ddd-ts-kit:` markers: a
   * change outside them is the team's and is reviewed.
   */
  readonly sections?: true;
}
