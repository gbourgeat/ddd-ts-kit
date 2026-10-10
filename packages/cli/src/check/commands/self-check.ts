import type { Arguments } from '../../commands/arguments.js';
import type { Io } from '../../commands/io.js';
import { runSelfCheck } from '../fixtures/run-self-check.js';

/** `check --self`: replays the rule fixtures shipped with the CLI and exits 0 when every rule behaves as expected. */
export function selfCheck(args: Arguments, io: Io): number {
  const outcomes = runSelfCheck();
  const failed = outcomes.filter((outcome) => !outcome.ok);

  if (args.json) {
    const fixtures = outcomes.map(({ fixture, ok, detail }) => ({
      ruleId: fixture.ruleId,
      name: fixture.name,
      ok,
      detail,
    }));

    io.out(JSON.stringify({ ok: failed.length === 0, fixtures }, null, 2));
  } else {
    for (const { fixture, ok, detail } of outcomes) {
      io.out(`${ok ? 'ok  ' : 'FAIL'}  ${fixture.ruleId}: ${fixture.name}${ok ? '' : `\n      ${detail}`}`);
    }

    io.out(`\n${outcomes.length - failed.length}/${outcomes.length} rule fixtures behave as expected.`);
  }

  return failed.length === 0 ? 0 : 1;
}
