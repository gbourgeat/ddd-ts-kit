export const AnalyticsCodes = {
  OutcomePeriodInverted: 'OUTCOME_ENDS_BEFORE_START',
  FiguresInconsistent: 'FIGURES_INCONSISTENT',
} as const;

export type AnalyticsCode = (typeof AnalyticsCodes)[keyof typeof AnalyticsCodes];
