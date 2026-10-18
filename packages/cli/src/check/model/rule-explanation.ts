/** What `check --explain` prints once for each rule it reports. */
export interface RuleExplanation {
  readonly id: string;
  readonly description: string;
  /** The reason behind the rule; for a rule another tool decides, where it is checked and how it is settled. */
  readonly why: string;
  /** The tool that decides a delegated rule, as `ddd-ts-kit rules --json` names it. */
  readonly checkedBy?: string;
}
