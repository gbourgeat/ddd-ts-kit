import { describe, expect, it } from 'vitest';
import { refusedCommand } from '../src/plan/refused-command';
import type { Replay } from '../src/plan/replay';
import { replayedPlan } from '../src/plan/replayed-plan';
import type { Slice } from '../src/progress/slice';

const ROW: Slice = {
  id: 'US6.01',
  context: 'catalog',
  kind: 'slice',
  slice: 'Revise product',
  startWith: '`generate command catalog ReviseProduct`',
  dependsOn: [],
  owner: 'catalog',
  status: 'todo',
};

describe('a refused command, as a problem of the plan', () => {
  it('gives its message on one line when the refusal and the fix of the generator hold several', () => {
    const replay: Replay = {
      row: ROW,
      command: 'generate command catalog ReviseProduct',
      argv: ['command', 'catalog', 'ReviseProduct'],
      heard: [],
      builtOn: [],
      created: [],
      refusal: {
        message: 'The modules of catalog:\n  pricing\n  listing',
        fix: 'Pass one:\n  --module pricing',
        missing: false,
      },
    };

    const [problem] = refusedCommand(replayedPlan([ROW], [replay]), 0, () => replay);

    expect(problem).toMatchObject({
      refusal: 'The modules of catalog:\n  pricing\n  listing',
      message:
        '#US6.01 `generate command catalog ReviseProduct` is refused by the generator: The modules of catalog: pricing listing Pass one: --module pricing',
    });
  });
});
