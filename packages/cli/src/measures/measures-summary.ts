/** The medians and shares over the period. */
export interface MeasuresSummary {
  readonly stories: number;
  readonly closed: number;
  readonly medianDesignHours?: number;
  readonly medianBuildHours?: number;
  readonly medianLeadHours?: number;
  readonly medianCriteriaChanges: number;
  readonly medianDecisions: number;
  readonly medianCompromises: number;
  readonly medianSettled: number;
  /** Stories whose report names `npm run verify`. */
  readonly verified: number;
  /** Stories whose `## Origin` names an intent, a ticket or an incident. */
  readonly withOrigin: number;
  /** Stories that overlapped another one in time. */
  readonly parallel: number;
  /** Rule ids or remarks seen in two stories or more. */
  readonly repeats: readonly string[];
  /** Fix stories whose incident repeats an earlier one. */
  readonly repeatIncidents: number;
}
