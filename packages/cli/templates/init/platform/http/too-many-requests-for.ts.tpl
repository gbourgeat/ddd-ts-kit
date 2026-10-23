import type { RateLimit, RateLimiter } from '@ddd-ts-kit/kernel';

const TOO_MANY_REQUESTS = 429;

/** What a caller over the limit receives: the status, the headers (`retry-after` says how long to wait) and the body, RFC 9457 problem details. */
export interface TooManyRequests {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/**
 * Asked for every request before authentication costs anything: one sliding window per caller
 * address. Answers nothing when the request may pass. Behind a proxy, make the HTTP server
 * trust it, or every caller shares the address of the proxy.
 */
export async function tooManyRequestsFor(
  limiter: RateLimiter,
  limit: RateLimit,
  address: string | undefined,
): Promise<TooManyRequests | undefined> {
  const decision = await limiter.consume('ip:' + (address ?? 'unknown'), limit);

  if (decision.allowed) {
    return undefined;
  }

  const problem = {
    type: 'urn:problem:rate-limited',
    title: 'Too Many Requests',
    status: TOO_MANY_REQUESTS,
    code: 'RATE_LIMITED',
  };

  return {
    status: TOO_MANY_REQUESTS,
    headers: {
      'content-type': 'application/problem+json',
      'retry-after': String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))),
    },
    body: JSON.stringify(problem),
  };
}
