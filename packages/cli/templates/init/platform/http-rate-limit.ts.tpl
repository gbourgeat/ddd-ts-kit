import type { RateLimit, RateLimiter } from '@ddd-ts-kit/kernel';

export const TOO_MANY_REQUESTS = 429;

/** What a refused caller receives: RFC 9457 problem details, and how long to wait in `retry-after`. */
export interface Refusal {
  readonly headers: Readonly<Record<string, string>>;
  readonly problem: { readonly type: string; readonly title: string; readonly status: number; readonly code: string };
}

/**
 * Asked for every request before authentication costs anything: one sliding window per caller
 * address. Answers nothing when the request may pass. Behind a proxy, make the HTTP server
 * trust it, or every caller shares the address of the proxy.
 */
export async function refusalFor(limiter: RateLimiter, limit: RateLimit, address: string | undefined): Promise<Refusal | undefined> {
  const decision = await limiter.consume('ip:' + (address ?? 'unknown'), limit);
  if (decision.allowed) return undefined;
  return {
    headers: { 'content-type': 'application/problem+json', 'retry-after': String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) },
    problem: { type: 'urn:problem:rate-limited', title: 'Too Many Requests', status: TOO_MANY_REQUESTS, code: 'RATE_LIMITED' },
  };
}
