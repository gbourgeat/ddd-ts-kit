/**
 * The top directories of a bounded context: a path cited from one of them (`application/ports/`)
 * is relative to its context. `test/` is left out: `test/e2e/` and `test/integration/` are
 * directories of the project root too.
 */
export const CONTEXT_LAYERS: readonly string[] = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'published-language',
];
