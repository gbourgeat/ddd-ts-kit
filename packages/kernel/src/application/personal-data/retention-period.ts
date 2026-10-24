/** A period in one unit, a positive whole number of it: what a retention lasts. */
export interface RetentionPeriod {
  readonly days?: number;
  readonly months?: number;
  readonly years?: number;
}
