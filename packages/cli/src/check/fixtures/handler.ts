import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { SAMPLES } from './samples';

/** The issue-invoice handler with the spec the other rules ask for. */
export function handler(body: string): FixtureFiles {
  return { [PATHS.HANDLER]: body, [PATHS.HANDLER_SPEC]: SAMPLES.SPEC };
}
