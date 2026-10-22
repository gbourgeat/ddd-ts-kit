import { FetchClient } from './fetch-client';
import type { HttpClient } from './http-client';
import { lowerCased } from './lower-cased';
import type { RequestOptions } from './request-options';
import { withoutTrailingSlashes } from './without-trailing-slashes';

export function createHttpClient(baseUrl: string, defaults: RequestOptions = {}): HttpClient {
  return new FetchClient(withoutTrailingSlashes(baseUrl), lowerCased(defaults.headers));
}
