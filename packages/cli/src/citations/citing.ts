/** Where a name is cited: its document, and the contexts its paths and close names are looked for in. */
export interface Citing {
  readonly document: string;
  readonly line: number;
  readonly contexts: readonly string[];
}
