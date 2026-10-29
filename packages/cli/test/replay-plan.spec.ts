import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayPlan } from '../src/plan/replay-plan';
import type { Slice } from '../src/progress/slice';
import { tempDir } from './helpers';

const DECISION: Slice = {
  id: 'US2.01',
  context: 'billing',
  kind: 'skeleton',
  slice: 'Choose the payment provider',
  startWith: 'none: a decision of the team',
  dependsOn: [],
  owner: 'conductor',
  status: 'todo',
};

describe('the replay of a plan', () => {
  it('copies nothing of a plan whose open rows run no generator command: the project is not even read', () => {
    const root = path.join(tempDir('replay-plan'), 'never-read');

    const replayed = replayPlan(root, [DECISION, { ...DECISION, id: 'US2.02', dependsOn: ['US2.01'] }], {
      context: null,
      generate: () => {
        throw new Error('no command to run');
      },
    });

    expect(replayed).toEqual({ problems: [], started: [] });
  });
});
