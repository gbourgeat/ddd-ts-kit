import type { HttpHeaders } from './http-headers.js';

export interface RequestOptions {
  /** Added to the default headers of the client; the same name replaces the default. */
  readonly headers?: HttpHeaders;
}
