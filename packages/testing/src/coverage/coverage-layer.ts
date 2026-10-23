import type { REFERENCE_COVERAGE } from './reference-coverage';

/** A layer of a context whose coverage is measured. */
export type CoverageLayer = keyof typeof REFERENCE_COVERAGE;
