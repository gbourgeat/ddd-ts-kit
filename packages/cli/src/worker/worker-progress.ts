/**
 * Where a worker stands, derived from git and from the files the kit and the guard write in its
 * worktree, never from what its agent says: its rows, the files of the row under way, the markers
 * left, its last verification, its report, its agent, and what the conductor does next.
 */
export interface WorkerProgress {
  /** Its rows, in the order of its scope file. */
  readonly rows: readonly ProgressRow[];
  /** The changed paths of its worktree that belong to its slice: those `verify-slice` would stage. */
  readonly inSlice: readonly string[];
  /** The other changed paths: never committed with a slice. */
  readonly leftOut: readonly string[];
  /** The markers left in its context: what `todo <context>` lists. */
  readonly markers: { readonly domain: number; readonly test: number };
  readonly verification: ProgressVerification | null;
  readonly report: ProgressReport | null;
  readonly agent: AgentRecord | null;
  readonly phase: 'not started' | 'mid-row' | 'between rows' | 'rows committed';
  readonly next: NextStep;
}

export interface ProgressRow {
  readonly id: string;
  /** The name of the row in the slices file; empty when the file does not hold it. */
  readonly slice: string;
  readonly state: 'committed' | 'in progress' | 'to do';
  /** The short hash of the commit that closed it. */
  readonly commit?: string;
  /** True when no `Slice:` trailer names it: matched in order with the `feat(<context>)` commits. */
  readonly byOrder?: boolean;
}

/** The last `verify-slice` of the worker, from `.ddd-ts-kit/verification.json`. */
export interface ProgressVerification {
  readonly at: string;
  readonly head: string | null;
  readonly row: string | null;
  readonly ok: boolean;
  /** The steps that failed: `regenerate`, `check`, `tests`. */
  readonly failed: readonly string[];
  readonly toStage: readonly string[];
  /** The files of the slice changed after it ran. */
  readonly changedAfter: number;
  /** True when a commit was made after it ran. */
  readonly committedAfter: boolean;
}

export interface ProgressReport {
  readonly modified: string;
  /** Written after the last commit and after the last change of a file of the slice. */
  readonly current: boolean;
}

/** What the guard records in `.ddd-ts-kit/agent.json` while a context-builder works in the worktree. */
export interface AgentRecord {
  readonly agentId: string;
  /** The run of the agent: 1 at its launch, one more at each resume. */
  readonly run: number;
  readonly runStartedAt: string;
  /** The commit checked out when the run started. */
  readonly runStartHead: string | null;
  /** When the guard last saw one of its tool calls. */
  readonly lastSeen: string;
  /** The tool calls the guard counted in this run (shell and writes; reads are not seen). */
  readonly toolCalls: number;
  /** The tool calls counted for each row it committed, by id. */
  readonly rowCosts: Readonly<Record<string, number>>;
  /** When it last stopped on its own, and whether its report was current then. */
  readonly lastStop: { readonly at: string; readonly reportCurrent: boolean } | null;
}

/**
 * `wait`: an agent is working; `send-message`: resume that agent, which keeps its history;
 * `new-agent`: launch a new one with the resume briefing; `merge`: every row is committed.
 */
export type NextStep =
  | { readonly action: 'wait' }
  | { readonly action: 'send-message'; readonly to: string }
  | { readonly action: 'new-agent' }
  | { readonly action: 'merge' };
