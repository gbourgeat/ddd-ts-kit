/** A state machine as its declaration writes it: what CONTEXT.md draws and `describe` lists. */
export interface StateMachineFacts {
  /** The aggregate it is the lifecycle of: the name of its file, `appointment`. */
  readonly aggregate: string;
  readonly file: string;
  /** In the order written; read from the transitions when the declaration lists them by a call. */
  readonly states: readonly string[];
  readonly initial: readonly string[];
  readonly transitions: readonly TransitionFacts[];
}

export interface TransitionFacts {
  readonly name: string;
  readonly from: readonly string[];
  /** Absent for a transition that keeps the state. */
  readonly to?: string;
  readonly guarded: boolean;
}
