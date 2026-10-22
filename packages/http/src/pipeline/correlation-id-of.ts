import type { RawHeaders } from '../route/raw-headers';
import { CORRELATION_HEADER } from './correlation-header';
import { wellFormedIdentifier } from './well-formed-identifier';

/** The incoming `x-correlation-id` when it is well formed; otherwise the request starts the chain. */
export function correlationIdOf(headers: Readonly<RawHeaders>, requestId: string): string {
  return wellFormedIdentifier(headers[CORRELATION_HEADER]) ?? requestId;
}
