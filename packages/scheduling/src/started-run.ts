import type { Occurrence } from './occurrence.js';

export interface StartedRun {
  readonly occurrence: Occurrence;
  readonly startedAt: Date;
  readonly correlationId: string;
}
