import type { Problem } from '../error/problem';

/** A refusal of a route, as a procedure throws it in the error of its protocol. */
export interface RpcRefusal {
  readonly status: number;
  /** The code of the problem, or `HTTP_<status>` for a refusal the route answers without one. */
  readonly code: string;
  /** The sentence of the problem, its detail or else its title; the code for a refusal without one. */
  readonly message: string;
  /** Absent for a refusal the route answers without a problem document. */
  readonly problem: Problem | undefined;
  /** What the route answered: the problem, or its own body. */
  readonly body: unknown;
}
