import type { FixtureFiles } from './fixture-files.js';
import { PATHS } from './paths.js';
import { SAMPLES } from './samples.js';

/** The invoice aggregate with the spec and the builder the other rules ask for. */
export function aggregate(body: string): FixtureFiles {
  return { [PATHS.AGGREGATE]: body, [PATHS.AGGREGATE_SPEC]: SAMPLES.SPEC, [PATHS.BUILDER]: 'export const anInvoice = 1;\n' };
}
