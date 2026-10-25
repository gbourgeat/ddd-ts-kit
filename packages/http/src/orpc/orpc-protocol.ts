import { ORPCError } from '@orpc/server';
import type { RpcProtocol } from '../rpc/rpc-answer';
import type { RpcRefusal } from '../rpc/rpc-refusal';

/**
 * A refusal is an `ORPCError` whose code is the code of the problem, its status the status, and its
 * data the problem document itself; a refusal without one carries the body the route answered.
 */
export const ORPC_PROTOCOL: RpcProtocol = { refuse: orpcErrorOf, carriesBinary: true };

function orpcErrorOf({ status, code, message, problem, body }: RpcRefusal): ORPCError<string, unknown> {
  if (problem === undefined) {
    return new ORPCError(code, { status, data: body });
  }

  return new ORPCError(code, { defined: true, status, message, data: problem });
}
