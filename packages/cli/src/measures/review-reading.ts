/** The markers a story settled and opened, with the text of each one settled, and the findings of its review file. */
export interface ReviewReading {
  readonly settled: number;
  readonly opened: number;
  /** The text of each marker settled, without its row id. */
  readonly remarks: readonly string[];
  /** The items of `## Findings` of the review file, by pass. */
  readonly findings: Readonly<Record<string, number>>;
  /** The text of each finding. */
  readonly findingTexts: readonly string[];
}
