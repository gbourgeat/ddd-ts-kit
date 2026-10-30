import { FIXTURES } from './fixtures';
import { runFixture, type FixtureOutcome } from './run-fixture';

/** Replays every fixture shipped with the CLI: what `ddd-ts-kit check --self` prints. */
export function runSelfCheck(): FixtureOutcome[] {
  return FIXTURES.map((fixture) => runFixture(fixture));
}
