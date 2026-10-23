import type { HttpHeaders } from './http-headers';

// Header names are case-insensitive: without this, `Authorization` given per call would be
// sent next to the default `authorization` instead of replacing it.
export function lowerCased(headers: HttpHeaders = {}): HttpHeaders {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
}
