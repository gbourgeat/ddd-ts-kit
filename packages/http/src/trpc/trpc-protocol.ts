import { TRPCError, type TRPC_ERROR_CODE_KEY } from '@trpc/server';
import type { RpcProtocol } from '../rpc/rpc-answer';
import type { RpcRefusal } from '../rpc/rpc-refusal';
import { RouteRefusal } from './route-refusal';

const FIRST_SERVER_FAULT = 500;

/** The code of tRPC for each status it knows: a status it does not know is a bad request, or a server fault. */
const CODES_BY_STATUS: Readonly<Record<number, TRPC_ERROR_CODE_KEY>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  402: 'PAYMENT_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_SUPPORTED',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  412: 'PRECONDITION_FAILED',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_CONTENT',
  428: 'PRECONDITION_REQUIRED',
  429: 'TOO_MANY_REQUESTS',
  499: 'CLIENT_CLOSED_REQUEST',
  500: 'INTERNAL_SERVER_ERROR',
  501: 'NOT_IMPLEMENTED',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

/**
 * A refusal is a `TRPCError` of the code tRPC has for its status, `UNAUTHORIZED` for 401,
 * `CONFLICT` for 409, whose cause carries the problem document: its code, the one of the kit, is
 * what a client tells refusals apart by, as tRPC has a fixed set of codes of its own.
 */
export const TRPC_PROTOCOL: RpcProtocol = { refuse: trpcErrorOf, carriesBinary: false };

function trpcErrorOf(refusal: RpcRefusal): TRPCError {
  return new TRPCError({
    code: codeOf(refusal.status),
    message: refusal.message,
    cause: new RouteRefusal(refusal),
  });
}

function codeOf(status: number): TRPC_ERROR_CODE_KEY {
  return CODES_BY_STATUS[status] ?? (status < FIRST_SERVER_FAULT ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
}
