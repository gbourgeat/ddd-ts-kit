import type { Slice } from '../progress/slice.js';
import type { AttributedMarker } from './attributed-marker.js';
import type { DesignDeparture } from './design-departure.js';

/** What a story is judged against. */
export interface StoryPlan {
  /** Every row of the slices file. */
  readonly rows: readonly Slice[];
  /** The markers that may keep it open, with the rows each belongs to. */
  readonly markers: readonly AttributedMarker[];
  /** The names of the contexts of the project. */
  readonly contexts: readonly string[];
  /** The names the design of its done rows cites that the code lacks; none when the design was not read. */
  readonly design?: readonly DesignDeparture[];
}
