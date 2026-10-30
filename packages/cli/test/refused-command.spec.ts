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

  it('says nothing of a file an earlier command of the same row generates: the worker has it', () => {
    const aggregate = 'src/contexts/catalog/domain/aggregates/product.aggregate.ts';

    const earlier: Replay = {
      row: ROW,
      command: 'generate aggregate catalog Product',
      argv: ['aggregate', 'catalog', 'Product'],
      heard: [],
      builtOn: [],
      created: [aggregate],
      refusal: undefined,
    };

    const refused: Replay = {
      row: ROW,
      command: 'generate command catalog ReviseProduct --aggregate Product',
      argv: ['command', 'catalog', 'ReviseProduct', '--aggregate', 'Product'],
      heard: [],
      builtOn: [aggregate],
      created: [],
      refusal: { message: 'Product has no revise method.', fix: 'Write it.', missing: false },
    };

    const [problem] = refusedCommand(replayedPlan([ROW], [earlier, refused]), 1, () => refused);

    expect(problem).toMatchObject({ rows: ['US6.01'], prerequisite: null });
  });
});
