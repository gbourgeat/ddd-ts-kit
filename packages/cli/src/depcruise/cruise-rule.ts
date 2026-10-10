/** One forbidden dependency, as dependency-cruiser reads it. */
export interface CruiseRule {
  readonly name: string;
  readonly severity: 'error';
  readonly comment: string;
  readonly from: Readonly<Record<string, unknown>>;
  readonly to: Readonly<Record<string, unknown>>;
}
