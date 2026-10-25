/** For each file, for each rule, how many errors the project had when the baseline was written. */
export type Baseline = Readonly<Record<string, Readonly<Record<string, BaselineEntry>>>>;

export interface BaselineEntry {
  readonly count: number;
}
