import { FetchClient } from './fetch-client.js';
import type { HttpClient } from './http-client.js';
import { lowerCased } from './lower-cased.js';
import type { RequestOptions } from './request-options.js';
import { withoutTrailingSlashes } from './without-trailing-slashes.js';

export function createHttpClient(baseUrl: string, defaults: RequestOptions = {}): HttpClient {
  return new FetchClient(withoutTrailingSlashes(baseUrl), lowerCased(defaults.headers));
}
