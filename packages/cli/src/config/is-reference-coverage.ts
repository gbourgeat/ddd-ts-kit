import type { Coverage } from './coverage.js';
import { COVERAGE_LAYERS } from './coverage-layers.js';
import { COVERAGE_METRICS } from './coverage-metrics.js';
import { REFERENCE_COVERAGE } from './reference-coverage.js';

/** True when no threshold departs from the reference: the config file then has nothing to say about coverage. */
export function isReferenceCoverage(coverage: Coverage): boolean {
  return COVERAGE_LAYERS.every((layer) =>
    COVERAGE_METRICS.every((metric) => coverage[layer][metric] === REFERENCE_COVERAGE[layer][metric]),
  );
}
