import { until } from '@ddd-ts-kit/testing/e2e';

export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const eventually = (condition: () => boolean | Promise<boolean>, timeoutMs = 15_000): Promise<void> =>
  until(condition, { timeoutMs, intervalMs: 10 });
