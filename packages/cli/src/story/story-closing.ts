import type { AttributedMarker } from './attributed-marker.js';
import type { DesignDeparture } from './design-departure.js';
import type { UnreferencedCommit } from './unreferenced-commit.js';

/** Whether a story or a milestone can close, and what keeps it open. */
export interface StoryClosing {
  /** Its code, the start of the ids of its rows: `M1` for `M1.01`, `M1.02`. */
  readonly story: string;
  /** The ids of its rows, in the order of the slices file. */
  readonly rows: readonly string[];
  /** The contexts of the project its rows belong to. */
  readonly contexts: readonly string[];
  /** The Context cells of its rows that name no context of the project (`all`, `platform`). */
  readonly unread: readonly string[];
  /** True with `--strict`: every marker of its contexts keeps it open, whoever it belongs to. */
  readonly strict: boolean;
  /** Its rows not done. */
  readonly open: readonly OpenRow[];
  /** The markers that keep it open: its own, each with why it is. */
  readonly markers: readonly StoryMarker[];
  /** The markers of its contexts that belong to no row while another open story works there: listed, not blocking. */
  readonly unattributed: readonly StoryMarker[];
  /** The markers of its contexts that belong to rows of other stories: not blocking. */
  readonly others: readonly AttributedMarker[];
  /** The names the design review of its done rows cites that the code lacks, no compromise listed: blocking. */
  readonly design: readonly DesignDeparture[];
  /** Its commits that change a migration or a container file without a `Change:` trailer: blocking under the regulated profile or `--strict`, listed otherwise. */
  readonly unreferenced: readonly UnreferencedCommit[];
  /** True when the config says `agents.profile: regulated`: a migration commit without a change reference then blocks. */
  readonly regulated: boolean;
  /** True when every row is done, no marker of its own is left, no done row departed from its design unsaid, and, held to it, no commit lacks its change reference. */
  readonly canClose: boolean;
}

/** A row of the story not done yet. */
export interface OpenRow {
  readonly id: string;
  readonly context: string;
  readonly slice: string;
  readonly status: string;
}

/** A marker the story has to settle, or one that may be its own. */
export interface StoryMarker extends AttributedMarker {
  /** Why it is the story's (`names #M1.03`, `written by 2443af2 Slice: M1.02`), or whose it may be. */
  readonly why: string;
  /** The other stories with a row not done in the context of the marker. */
  readonly sharedWith: readonly string[];
  /** What settles it. */
  readonly fix: string;
}
