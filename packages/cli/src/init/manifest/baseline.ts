/** One gate of the quality baseline: what it holds, the script `verify` chains for it and the scripts the pipeline calls for it. */
export interface BaselineGate {
  readonly gate: string;
  readonly verify: string;
  readonly pipeline: readonly string[];
}

/**
 * The gates every project runs, whatever its stack, in the order `verify` chains them. One list
 * on purpose: `verify` is built from it, and a test holds the GitHub and the GitLab pipelines to
 * it, so that a gate cannot leave one of the three places silently.
 */
export const BASELINE: readonly BaselineGate[] = [
  { gate: 'type check, sources and tests', verify: 'typecheck', pipeline: ['ci:typecheck'] },
  { gate: 'lint', verify: 'lint', pipeline: ['ci:lint'] },
  { gate: 'format', verify: 'format:check', pipeline: ['ci:format'] },
  {
    gate: 'unit and integration tests, coverage thresholds',
    verify: 'test:coverage',
    pipeline: ['ci:test:unit', 'ci:test:integration'],
  },
  { gate: 'end-to-end tests', verify: 'test:e2e', pipeline: ['ci:test:e2e'] },
  { gate: 'architecture', verify: 'check:arch', pipeline: ['ci:arch:check'] },
  { gate: 'dependency graph', verify: 'depcruise', pipeline: ['ci:arch:graph'] },
  { gate: 'dead code', verify: 'deadcode', pipeline: ['ci:deadcode'] },
  { gate: 'generated documents', verify: 'docs:check', pipeline: ['ci:docs'] },
];
