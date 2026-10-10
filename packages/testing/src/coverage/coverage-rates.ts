/** The four rates of a coverage report, each a percentage a layer must reach. */
export interface CoverageRates {
  readonly statements: number;
  readonly branches: number;
  readonly functions: number;
  readonly lines: number;
}
