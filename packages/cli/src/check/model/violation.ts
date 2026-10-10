export interface Violation {
  readonly ruleId: string;
  readonly severity: 'error' | 'warn';
  readonly file: string;
  readonly line: number;
  readonly message: string;
  /** One sentence saying what to do instead; written for whoever has to repair the code. */
  readonly fix: string;
}
