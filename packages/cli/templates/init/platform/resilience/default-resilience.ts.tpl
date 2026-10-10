import type { ResilienceSettings } from './resilience-settings.js';

/** What the tools and the tests run with; `main.ts` gives the validated values of the configuration. */
export const defaultResilience: ResilienceSettings = { retryAttempts: 3, retryBaseDelayMs: 100, timeoutMs: 2000 };
