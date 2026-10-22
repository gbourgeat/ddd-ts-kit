import type { Slice } from './slice';

/** Where the work stands: the next step of the plan, the slices, and what the generators left to fill. */
export interface Progress {
  /** What follows `Next: ` in `docs/architecture/plan.md`; null when the project has no plan or the plan has no such line. */
  readonly next: string | null;
  /** Null when the project has no `docs/architecture/slices.md`, or the file has no slices table. */
  readonly slices: SlicesProgress | null;
  /** One entry per context, then one with an empty context for the rest of the project when something is left there. */
  readonly remaining: readonly RemainingCount[];
}

export interface SlicesProgress {
  readonly file: string;
  readonly rows: readonly StatusRow[];
  /** The ids of the rows, by status. */
  readonly byStatus: Readonly<Record<string, readonly string[]>>;
  /** The ids of the rows, by owner then by status. */
  readonly byOwner: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** The ids that more than one row carries, across the tables of the file: each such row is counted. */
  readonly duplicates: readonly string[];
  /** The ids that are a bare number, without the code of their story or milestone (`12`, not `US5.12`). */
  readonly unscoped: readonly string[];
  /** The rows not marked done that landed on the trunk with a worker's branch, with the commit that took them in. */
  readonly landedNotDone: readonly { readonly id: string; readonly commit: string }[];
  /** The stories and milestones whose rows are all done while markers of their own keep them open (`story-check`). */
  readonly unclosed: readonly UnclosedStory[];
}

/** A story or a milestone whose rows are all done, that `story-check` refuses to close. */
export interface UnclosedStory {
  /** Its code: `M1` for the rows `M1.01`, `M1.02`. */
  readonly story: string;
  /** The markers of its own that keep it open, as `story-check` attributes them. */
  readonly markers: number;
  /** The command that lists them. */
  readonly command: string;
}

/** A row of the slices table; one not done says whether it can start, and what it waits for. */
export interface StatusRow extends Slice {
  /**
   * Left out on a done row. `trunk`: every dependency is done. `branch`: each one not done is a
   * row briefed to a worker whose branch has commits its base does not have. `waiting` otherwise.
   */
  readonly ready?: 'trunk' | 'branch' | 'waiting';
  /** The dependencies not done, in the order of the row; left out on a done row. */
  readonly waitingFor?: readonly string[];
}

export interface RemainingCount {
  readonly context: string;
  /** `TODO(domain)` markers. */
  readonly domain: number;
  /** `TODO(platform)` markers. */
  readonly platform: number;
  /** `it.todo` entries. */
  readonly test: number;
  /** `TODO(review)` markers: remarks of a review not settled yet. */
  readonly review: number;
}
