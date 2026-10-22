import type { Occurrence } from './occurrence';

export interface StartedRun {
  readonly occurrence: Occurrence;
  readonly startedAt: Date;
  readonly correlationId: string;
}
