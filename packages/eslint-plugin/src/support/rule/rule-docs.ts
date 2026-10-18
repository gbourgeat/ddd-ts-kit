export interface RuleDocs {
  readonly description: string;
  /** The id of docs/ARCHITECTURE.md, with its slash. */
  readonly ruleId: string;
  /** The name of the rule in ESLint, without the plugin prefix. */
  readonly name: string;
  readonly recommended: 'error' | 'warn';
  /**
   * The version of the kit in which this rule, a warning while projects upgrade, becomes an error.
   * `ddd-ts-kit lint` shows its warnings without failing on them until then.
   */
  readonly transition?: string;
}
