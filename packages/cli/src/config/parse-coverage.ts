import type { Coverage, CoverageRates } from './coverage.js';
import type { COVERAGE_METRICS } from './coverage-metrics.js';
import { isRate } from './is-rate.js';
import { REFERENCE_COVERAGE } from './reference-coverage.js';
import { isRecord } from './values/is-record.js';

/** Tolerant like the rest of the config: a rate that is not a percentage is read as the reference, and `check` says so. */
export function parseCoverage(value: unknown): Coverage {
  const raw = isRecord(value) ? value : {};

  return {
    domain: ratesOf(raw['domain'], REFERENCE_COVERAGE.domain),
    application: ratesOf(raw['application'], REFERENCE_COVERAGE.application),
    presentation: ratesOf(raw['presentation'], REFERENCE_COVERAGE.presentation),
    infrastructure: ratesOf(raw['infrastructure'], REFERENCE_COVERAGE.infrastructure),
  };
}

function ratesOf(value: unknown, reference: CoverageRates): CoverageRates {
  const raw = isRecord(value) ? value : {};

  const rate = (metric: (typeof COVERAGE_METRICS)[number]): number => {
    const written = raw[metric];

    return isRate(written) ? written : reference[metric];
  };

  return {
    statements: rate('statements'),
    branches: rate('branches'),
    functions: rate('functions'),
    lines: rate('lines'),
  };
}
