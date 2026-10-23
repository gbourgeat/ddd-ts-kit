import type { BackgroundJobPolicy } from './background-job-policy';

/** How long to wait before the attempt that follows `attempt`: exponential, capped. */
export function retryDelayMs({ backoff }: BackgroundJobPolicy, attempt: number): number {
  const { baseMs, factor, maxMs } = backoff;

  return Math.min(maxMs, baseMs * factor ** Math.max(0, attempt - 1));
}
