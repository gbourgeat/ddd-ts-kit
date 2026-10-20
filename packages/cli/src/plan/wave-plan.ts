/** What `plan-waves` says: the rows not done, in waves, cut into batches, with the order of their merges. */
export interface WavePlan {
  readonly file: string;
  /** The context asked for; null for the whole plan. */
  readonly context: string | null;
  /** What makes the plan impossible to order; when there is one, `waves` and `mergeOrder` are empty. */
  readonly problems: readonly PlanProblem[];
  readonly waves: readonly Wave[];
  /** The ids of the batches, by wave, then the batch more rows wait for first. */
  readonly mergeOrder: readonly string[];
  /** The rows not done that a planned row of another story depends on, in the order of the file. */
  readonly otherStories: readonly OtherStoryRow[];
}

export interface PlanProblem {
  readonly kind: 'cycle' | 'unknown-dependency' | 'no-owner' | 'duplicate-id';
  /** The ids involved, in order: the rows of a cycle, a row then the id it names. */
  readonly rows: readonly string[];
  readonly message: string;
}

/** Wave 1 holds the rows whose dependencies are all done; wave n the rows whose dependencies are done or in earlier waves. */
export interface Wave {
  readonly wave: number;
  readonly batches: readonly Batch[];
}

/** One or two rows of one owner in one context, for one agent. */
export interface Batch {
  /** `W<wave>.<number>`. */
  readonly id: string;
  /** `conductor`, the name of a context, or a person. */
  readonly owner: string;
  readonly context: string;
  readonly rows: readonly PlannedRow[];
  /** The aggregates its `Start with` names; empty when it names none, which says nothing of the files it touches. */
  readonly aggregates: readonly string[];
  /** The command that briefs its worker; null for the conductor and for a person, whom `worker-scope` does not brief. */
  readonly brief: string | null;
  /** The batches of the same wave and context that name one of its aggregates: likely to touch the same files. */
  readonly sameFiles: readonly string[];
  /** The batches of the same wave and context where one side names no aggregate: whether they meet is unknown. */
  readonly unknownOverlap: readonly string[];
}

export interface PlannedRow {
  readonly id: string;
  readonly kind: string;
  readonly slice: string;
  readonly status: string;
  /** The story or milestone of the row, its id without the last `.<number>` (`US1` for `US1.02`); null for an id without it. */
  readonly story: string | null;
  /** The dependencies not done yet, each in an earlier wave. */
  readonly waitingFor: readonly string[];
  /** The rows of `waitingFor`, in its order, with where they belong and their status. */
  readonly waitingForRows: readonly WaitedRow[];
}

/** A row not done that a planned row waits for, shown in the waves or not. */
export interface WaitedRow {
  readonly id: string;
  readonly context: string;
  readonly story: string | null;
  /** `todo` or `in progress`. */
  readonly status: string;
}

/** A row not done of one story that rows of another story wait for: they start once it is done. */
export interface OtherStoryRow {
  readonly id: string;
  readonly context: string;
  readonly story: string | null;
  readonly kind: string;
  readonly slice: string;
  readonly owner: string;
  readonly status: string;
  /** The batch that holds it; null when it is not shown, being outside the context asked for. */
  readonly batch: string | null;
  /** The planned rows of other stories that depend on it, in the order of the file. */
  readonly waitedForBy: readonly string[];
}
