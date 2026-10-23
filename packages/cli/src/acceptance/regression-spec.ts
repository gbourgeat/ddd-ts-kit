import type { ScenarioState } from './scenario';

/** One `it` or `test` of a regression spec of a fix, fingerprinted as a scenario of an acceptance is. */
export interface RegressionTest {
  readonly title: string;
  readonly line: number;
  readonly state: ScenarioState;
  readonly fingerprint: string;
}

/**
 * A spec file the `## Regression` section of a fix lists, relative to the project root, with its
 * tests; `found` is false when the file is not there.
 */
export interface RegressionSpec {
  readonly file: string;
  readonly found: boolean;
  readonly tests: readonly RegressionTest[];
}
