/** A mini-project proving one rule one way: what it holds, and what the rule has to say about it. */
export interface Fixture {
  readonly ruleId: string;
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  /** `pass`: no violation at all. Otherwise the file the rule has to report. */
  readonly expect: 'pass' | { readonly file: string };
  /** Other rules that legitimately fire on the same mistake. */
  readonly also?: readonly string[];
  /** The severity of the expected violation, when it is not the default of its rule. */
  readonly severity?: 'error' | 'warn';
}
