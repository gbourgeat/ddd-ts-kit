import type { RequestEventData } from '@sentry/node';

const CREDENTIAL_HEADER =
  /auth|cookie|token|secret|password|session|signature|api-?key|csrf|forwarded|real-ip|client-ip/i;

/**
 * Keeps the method, the URL without query string or fragment, and the headers that carry
 * neither a credential nor the address of the caller. The body, the cookies, the query string
 * and the environment are dropped.
 */
export function scrubRequest(request: RequestEventData): RequestEventData {
  const headers = Object.entries(request.headers ?? {}).filter(([name]) => !CREDENTIAL_HEADER.test(name));

  return {
    ...(request.method === undefined ? {} : { method: request.method }),
    ...(request.url === undefined ? {} : { url: withoutQuery(request.url) }),
    ...(headers.length === 0 ? {} : { headers: Object.fromEntries(headers) }),
  };
}

function withoutQuery(url: string): string {
  return url.replace(/[?#].*$/s, '');
}
