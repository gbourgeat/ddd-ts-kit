import type { HttpHeaders } from './http-headers';

export interface HttpResponse<Body = unknown> {
  readonly status: number;
  /** Names in lower case. */
  readonly headers: HttpHeaders;
  /** Parsed when the content type is JSON, the text otherwise, `undefined` when empty. */
  readonly body: Body;
}
