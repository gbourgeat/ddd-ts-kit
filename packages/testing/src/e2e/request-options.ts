import type { HttpHeaders } from './http-headers';

export interface RequestOptions {
  /** Added to the default headers of the client; the same name replaces the default. */
  readonly headers?: HttpHeaders;
}
