import { FIXTURES } from './fixtures.js';
import { runFixture, type FixtureOutcome } from './run-fixture.js';

/** Replays every fixture shipped with the CLI: what `ddd-ts-kit check --self` prints. */
export function runSelfCheck(): FixtureOutcome[] {
  return FIXTURES.map(runFixture);
}
