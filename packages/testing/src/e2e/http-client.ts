import type { HttpHeaders } from './http-headers';
import type { HttpResponse } from './http-response';
import type { RequestOptions } from './request-options';

/**
 * A JSON client on the global `fetch`. It never throws on a status: a 4xx or 5xx answer is a
 * response to assert. `Body` is the caller's claim about what the API answers.
 */
export interface HttpClient {
  get<Body = unknown>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>>;
  post<Body = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>>;
  put<Body = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>>;
  patch<Body = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>>;
  delete<Body = unknown>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>>;
  /** A client sending these headers as well: another user, another tenant. */
  withHeaders(headers: HttpHeaders): HttpClient;
}
