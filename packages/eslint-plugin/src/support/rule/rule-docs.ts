export interface RuleDocs {
  readonly description: string;
  /** The id of docs/ARCHITECTURE.md, with its slash. */
  readonly ruleId: string;
  /** The name of the rule in ESLint, without the plugin prefix. */
  readonly name: string;
  readonly recommended: 'error' | 'warn';
}
