import type { ReviewMeasures } from './review-measures.js';
import type { Rework } from './rework.js';

/** What was asked of one story at its design review, its build and its close, read from git and `docs/architecture/`. */
export interface StoryMeasures {
  /** Its code, `US5`. */
  readonly story: string;
  /** `docs/architecture/stories/US5.md`. */
  readonly file: string;
  /** Who made the first commit of the story file; with `--by-author` only. */
  readonly author?: string;
  /** The day of the first commit of the story file, ISO; absent without git history. */
  readonly opened?: string;
  /** The first commit of the story file to the commit of its acceptance lock, in hours. */
  readonly designHours?: number;
  /** The lock commit to the first commit whose `## Report` holds text, in hours. */
  readonly buildHours?: number;
  /** The first commit of the story file to the commit of the current branch that carries its branch; absent while open. */
  readonly leadHours?: number;
  /** The abbreviated commit that merged the branch of the story. */
  readonly merged?: string;
  readonly rework: Rework;
  /** The `D<n>` lines of the story. */
  readonly decisions: number;
  /** The items under `### Compromises` of the report. */
  readonly compromises: number;
  /** True when the report has a `### Verification` block naming `npm run verify`. */
  readonly verification: boolean;
  /** What `## Origin` names; absent when the block is missing or names nothing. */
  readonly origin?: 'intent' | 'ticket' | 'incident';
  readonly review: ReviewMeasures;
  /** The other stories whose commits overlap this one in time. */
  readonly overlaps: readonly string[];
  /** For a story whose origin is an incident: the earlier incident with the same message or error code. */
  readonly repeatIncident?: string;
}
