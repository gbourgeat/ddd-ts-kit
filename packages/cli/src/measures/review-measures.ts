/** What the review of the story left and settled. */
export interface ReviewMeasures {
  /** `TODO(review)` markers the commits of the story removed. */
  readonly settled: number;
  /** `TODO(review)` markers the commits of the story wrote. */
  readonly opened: number;
  /** The items of `## Findings` of the review file, by pass; empty without that section. */
  readonly findings: Readonly<Record<string, number>>;
  /** A rule id or a remark of this story that another story also carries. */
  readonly repeats: readonly string[];
}
