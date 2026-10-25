import type { RawRequest } from '../pipeline/raw-request';
import type { RawHeaders } from '../route/raw-headers';
import { isRecord } from '../support/is-record';
import type { RpcContext } from './rpc-context';
import type { RpcInput } from './rpc-input';

const JSON_MEDIA_TYPE = 'application/json';
/** Headers that describe the RPC request itself, not the call it carries. */
const TRANSPORT_HEADERS = new Set(['content-length', 'content-type', 'transfer-encoding']);

/**
 * The request the pipeline runs for a call: the parameters and the body of its input, the headers
 * of the RPC request with those of its input over them. It accepts and sends JSON only, whatever
 * the RPC request says: a representation other than JSON belongs to the HTTP routes.
 */
export function rpcRequest(input: unknown, context: RpcContext): RawRequest {
  const { path, query, header, body } = inputOf(input);

  const headers: RawHeaders = {
    ...Object.fromEntries(Object.entries(context.headers).filter(([name]) => !TRANSPORT_HEADERS.has(name))),
    ...headersOf(header),
    accept: JSON_MEDIA_TYPE,
    ...(body === undefined ? {} : { 'content-type': JSON_MEDIA_TYPE }),
  };

  return { params: path ?? {}, query: query ?? {}, headers, body, raw: context.raw ?? { headers } };
}

function inputOf(input: unknown): RpcInput {
  return isRecord(input) ? input : {};
}

/** The names in lower case, as Node reads them; a value that is not a string is sent as its text. */
function headersOf(header: RpcInput['header']): RawHeaders {
  const entries = Object.entries(header ?? {}).filter(([, value]) => value !== undefined && value !== null);

  return Object.fromEntries(entries.map(([name, value]) => [name.toLowerCase(), String(value)]));
}
