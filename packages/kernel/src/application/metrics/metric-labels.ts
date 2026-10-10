/**
 * Dimensions of a measurement. Values are strings from a small, closed set: never an
 * identifier, never user input. An undefined label is left out. A project declares its
 * well-known labels by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface MetricLabels { region?: 'eu' | 'us' | undefined }
 *     }
 */
export interface MetricLabels {
  /** Bounded context the measurement is about. */
  context?: string | undefined;
  outcome?: 'success' | 'failure' | undefined;
  [label: string]: string | undefined;
}
