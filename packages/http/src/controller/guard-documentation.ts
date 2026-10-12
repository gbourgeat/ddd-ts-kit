/** What a guard says in the contract of every route behind it, so no route repeats it. */
export interface GuardDocumentation {
  /** `true` on the guard that lets everybody in: the route is documented with no security requirement. */
  readonly public?: boolean;
  /** The security schemes the guard authenticates with, when they are not the ones of the application. */
  readonly security?: readonly string[];
  /** The error codes the guard may answer: they join the declared codes of the route. */
  readonly errors?: readonly string[];
}
