import type { Context } from 'hono';
import type { RawHeaders } from '../route/raw-headers.js';

/**
 * What `resolvePrincipal` and the hooks receive as the request on Hono: the headers as a plain
 * record, which the authenticators of the kit read, and the context of Hono for the rest.
 */
export interface HonoRaw {
  readonly headers: RawHeaders;
  readonly context: Context;
}
