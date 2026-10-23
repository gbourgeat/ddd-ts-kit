import type { CoverageRates } from './coverage-rates';

/**
 * The floors a project is held to when its config file says nothing, the same ones
 * `ddd-ts-kit check` reads a lowered threshold against. The domain is the highest: it is pure and
 * holds the rules of the business. The infrastructure is the lowest: the failure branches of a
 * driver are not its to test, and its adapters are held by contract suites.
 */
export const REFERENCE_COVERAGE = {
  domain: { statements: 90, branches: 85, functions: 90, lines: 90 },
  application: { statements: 85, branches: 80, functions: 85, lines: 85 },
  presentation: { statements: 80, branches: 70, functions: 80, lines: 80 },
  infrastructure: { statements: 70, branches: 60, functions: 70, lines: 70 },
} as const satisfies Readonly<Record<string, CoverageRates>>;
