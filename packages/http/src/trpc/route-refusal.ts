import type { Problem } from '../error/problem';
import type { RpcRefusal } from '../rpc/rpc-refusal';

/** The cause of the `TRPCError` of a refusal: what the error formatter of `trpcRouter` reads the problem from. */
export class RouteRefusal extends Error {
  readonly problem: Problem | undefined;

  constructor(refusal: RpcRefusal) {
    super(refusal.message);
    this.name = 'RouteRefusal';
    this.problem = refusal.problem;
  }
}
