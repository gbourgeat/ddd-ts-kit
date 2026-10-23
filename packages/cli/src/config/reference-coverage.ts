import type { Coverage } from './coverage';

/**
 * The floors of the reference. The domain is the highest: it is pure, needs no double and holds the
 * rules of the business. The application orchestrates through ports, with fakes. The presentation
 * maps a transport, whose error paths are also held end to end. The infrastructure is the lowest:
 * its failure branches belong to a driver, and its adapters are held by the contract suites of the
 * integration specs. A project may raise any of them freely; lowering one is a recorded deviation.
 */
export const REFERENCE_COVERAGE: Coverage = {
  domain: { statements: 90, branches: 85, functions: 90, lines: 90 },
  application: { statements: 85, branches: 80, functions: 85, lines: 85 },
  presentation: { statements: 80, branches: 70, functions: 80, lines: 80 },
  infrastructure: { statements: 70, branches: 60, functions: 70, lines: 70 },
};
