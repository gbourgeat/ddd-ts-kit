/** A state machine as data: for a diagram, a describe command or a test. */
export interface StateMachineDescription {
  readonly states: readonly string[];
  readonly initial: readonly string[];
  /** The states no transition leaves. */
  readonly final: readonly string[];
  /** Each arrow: one per state a transition leaves. A transition that keeps the state is an arrow onto itself. */
  readonly arrows: readonly {
    readonly transition: string;
    readonly from: string;
    readonly to: string;
    readonly guarded: boolean;
  }[];
}
