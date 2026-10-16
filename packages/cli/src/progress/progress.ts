import type { Slice } from './slice.js';

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
  readonly rows: readonly Slice[];
  /** The ids of the rows, by status. */
  readonly byStatus: Readonly<Record<string, readonly string[]>>;
  /** The ids of the rows, by owner then by status. */
  readonly byOwner: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** The ids that more than one row carries, across the tables of the file: each such row is counted. */
  readonly duplicates: readonly string[];
  /** The ids that are a bare number, without the code of their story or milestone (`12`, not `US5.12`). */
  readonly unscoped: readonly string[];
}

export interface RemainingCount {
  readonly context: string;
  /** `TODO(domain)` markers. */
  readonly domain: number;
  /** `TODO(platform)` markers. */
  readonly platform: number;
  /** `it.todo` entries. */
  readonly test: number;
}
