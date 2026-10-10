import type { COVERAGE_LAYERS } from './coverage-layers.js';
import type { COVERAGE_METRICS } from './coverage-metrics.js';

export type CoverageRates = Readonly<Record<(typeof COVERAGE_METRICS)[number], number>>;

/** The minimum coverage of each layer, applied to every context: a floor a run must reach, not a goal. */
export type Coverage = Readonly<Record<(typeof COVERAGE_LAYERS)[number], CoverageRates>>;
