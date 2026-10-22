import type { ReportMeasures } from './report-measures';
import type { ReviewReading } from './review-reading';
import type { Rework } from './rework';
import type { StoryHistory } from './story-history';
import type { Timeline } from './timeline';

/** One story as read, before the measures that compare stories. */
export interface StoryReading {
  readonly history: StoryHistory;
  readonly timeline: Timeline;
  readonly rework: Rework;
  readonly report: ReportMeasures;
  readonly review: ReviewReading;
  /** For a story whose origin is an incident: the earlier incident with the same message or error code. */
  readonly repeatIncident?: string;
}
