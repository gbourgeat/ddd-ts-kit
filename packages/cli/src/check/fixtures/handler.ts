import type { FixtureFiles } from './fixture-files.js';
import { PATHS } from './paths.js';
import { SAMPLES } from './samples.js';

/** The issue-invoice handler with the spec the other rules ask for. */
export function handler(body: string): FixtureFiles {
  return { [PATHS.HANDLER]: body, [PATHS.HANDLER_SPEC]: SAMPLES.SPEC };
}
