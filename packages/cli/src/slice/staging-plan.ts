/** What a slice commits, and what the working tree holds besides, which is never committed with it. */
export interface StagingPlan {
  readonly toStage: readonly string[];
  readonly leftOut: readonly string[];
}
