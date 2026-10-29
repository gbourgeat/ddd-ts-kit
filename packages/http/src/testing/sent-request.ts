import type { Readable } from 'node:stream';
import type { RawHeaders } from '../route/raw-headers';

/** What a spec sends a route: each part it leaves out is empty, `{}` for the path parameters, the query string and the headers, nothing for the body. */
export interface SentRequest {
  readonly params?: unknown;
  readonly query?: unknown;
  readonly headers?: RawHeaders;
  readonly body?: unknown;
  readonly raw?: unknown;
  /** The body as it arrives, which an upload and a raw body are read from. */
  readonly stream?: Readable;
}
