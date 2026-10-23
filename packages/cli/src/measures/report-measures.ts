/** What the story file says of its decisions, its compromises, its verification and its origin. */
export interface ReportMeasures {
  /** The `D<n>` lines of the story. */
  readonly decisions: number;
  /** The items under `### Compromises` of the report. */
  readonly compromises: number;
  /** True when the report has a `### Verification` block naming `npm run verify`. */
  readonly verification: boolean;
  /** What `## Origin` names; absent when the block is missing or names nothing. */
  readonly origin?: 'intent' | 'ticket' | 'incident';
  /** `docs/architecture/incidents/<name>.md`, when the origin names one. */
  readonly incident?: string;
}
