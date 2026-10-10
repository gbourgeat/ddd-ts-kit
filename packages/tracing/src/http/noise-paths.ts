/** Paths that get no span by default: probes, metrics scrapes, documentation, browser plumbing. */
export const NOISE_PATHS: readonly string[] = [
  '/health',
  '/healthz',
  '/livez',
  '/live',
  '/ready',
  '/readyz',
  '/startup',
  '/metrics',
  '/docs',
  '/openapi.json',
  '/favicon.ico',
];
