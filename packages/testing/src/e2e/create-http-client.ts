import { FetchClient } from './fetch-client.js';
import type { HttpClient } from './http-client.js';
import { lowerCased } from './lower-cased.js';
import type { RequestOptions } from './request-options.js';

export function createHttpClient(baseUrl: string, defaults: RequestOptions = {}): HttpClient {
  return new FetchClient(baseUrl.replace(/\/+$/, ''), lowerCased(defaults.headers));
}
