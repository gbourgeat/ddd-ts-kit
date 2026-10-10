import type { RouteResponse } from './route-response.js';

/**
 * The bytes every adapter writes, so the three frameworks answer identically. A string or
 * binary body is sent as is when the handler chose its own content type; anything else is JSON.
 */
export function serializeBody(response: RouteResponse): string | Uint8Array | undefined {
  const { body } = response;

  if (body === undefined) {
    return undefined;
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  const isJson = /[/+]json\b/.test(response.headers['content-type'] ?? '');

  return typeof body === 'string' && !isJson ? body : JSON.stringify(body);
}
