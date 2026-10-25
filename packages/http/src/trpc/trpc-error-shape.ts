import type { TRPC_ERROR_CODE_KEY, TRPCErrorShape } from '@trpc/server';
import type { Problem } from '../error/problem';

/** The data of an error of `trpcRouter`, what `error.data` holds for a client. */
export interface TrpcErrorData {
  readonly code: TRPC_ERROR_CODE_KEY;
  readonly httpStatus: number;
  readonly path?: string;
  /**
   * The problem document the route answered: its `code`, the one of the kit, its status, its
   * issues. `null` for a refusal the route answers without one, and for an error of tRPC itself
   * (an unknown procedure, a request it cannot read).
   */
  readonly problem: Problem | null;
}

/** The error of `trpcRouter`, as a client of its type reads it. */
export type TrpcErrorShape = TRPCErrorShape<TrpcErrorData>;
