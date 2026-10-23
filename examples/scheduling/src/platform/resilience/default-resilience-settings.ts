import type { ResilienceSettings } from '@/platform/resilience/resilience-settings';

/** What the tools and the tests run with; `main.ts` gives the validated values of the configuration. */
export const defaultResilienceSettings: ResilienceSettings = {
  retryAttempts: 3,
  retryBaseDelayMs: 100,
  timeoutMs: 2000,
};
