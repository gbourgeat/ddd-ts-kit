import type { Coverage } from './coverage';
import { COVERAGE_LAYERS } from './coverage-layers';
import { COVERAGE_METRICS } from './coverage-metrics';
import { REFERENCE_COVERAGE } from './reference-coverage';

/** True when no threshold departs from the reference: the config file then has nothing to say about coverage. */
export function isReferenceCoverage(coverage: Coverage): boolean {
  return COVERAGE_LAYERS.every((layer) =>
    COVERAGE_METRICS.every((metric) => coverage[layer][metric] === REFERENCE_COVERAGE[layer][metric]),
  );
}
