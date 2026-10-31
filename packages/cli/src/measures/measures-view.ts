import type { AuthorMeasures } from './author-measures';
import type { MeasuresSummary } from './measures-summary';
import type { StoryMeasures } from './story-measures';

/** What `ddd-ts-kit measures` prints. */
export interface MeasuresView {
  /** The branch read, or `none` outside a git repository or before the first commit. */
  readonly branch: string;
  readonly since?: string;
  readonly stories: readonly StoryMeasures[];
  readonly summary: MeasuresSummary;
  readonly byAuthor?: Readonly<Record<string, AuthorMeasures>>;
  /** The measures this version leaves to the platform. */
  readonly notComputed: readonly string[];
}
