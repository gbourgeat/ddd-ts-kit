import type { Readable } from 'node:stream';
import type { RawHeaders } from '../route/raw-headers.js';

/** What an adapter extracts from its framework before handing over to `executeRoute`. */
export interface RawRequest {
  readonly params: unknown;
  readonly query: unknown;
  readonly headers: RawHeaders;
  readonly body: unknown;
  readonly raw: unknown;
  /** The body as it arrives, which an upload and a raw body are read from. */
  readonly stream?: Readable;
}
