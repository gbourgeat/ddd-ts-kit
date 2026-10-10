import type { RawHeaders } from '../route/raw-headers.js';

/** What an adapter extracts from its framework before handing over to `executeRoute`. */
export interface RawRequest {
  readonly params: unknown;
  readonly query: unknown;
  readonly headers: RawHeaders;
  readonly body: unknown;
  readonly raw: unknown;
}
