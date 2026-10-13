/** A transition asked of a state it does not leave: what the refusal factory is given. */
export interface ForbiddenTransition<State extends string, Name extends string> {
  readonly from: State;
  readonly transition: Name;
}
