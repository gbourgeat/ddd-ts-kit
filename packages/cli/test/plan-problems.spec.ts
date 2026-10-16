import { describe, expect, it } from 'vitest';
import { planProblems } from '../src/plan/plan-problems.js';
import type { Slice } from '../src/progress/slice.js';

const row = (id: string, dependsOn: readonly string[] = [], owner = 'billing'): Slice => ({
  id,
  context: 'billing',
  kind: 'slice',
  slice: `Slice ${id}`,
  startWith: '',
  dependsOn,
  owner,
  status: 'todo',
});

describe('what keeps a plan from being ordered', () => {
  it('names an id two rows carry, a dependency on an id no row carries and a row without owner', () => {
    const rows = [row('US1.01'), row('US1.01'), row('US1.02', ['US1.09']), row('US1.03', [], '')];

    expect(planProblems(rows, rows).map(({ kind, rows: ids }) => [kind, ids])).toEqual([
      ['duplicate-id', ['US1.01']],
      ['unknown-dependency', ['US1.02', 'US1.09']],
      ['no-owner', ['US1.03']],
    ]);
  });

  it('names a cycle with every row of it, and nothing for a plan that can be ordered', () => {
    const cycle = [row('US1.01', ['US1.02']), row('US1.02', ['US1.01'])];
    const ordered = [row('US1.01'), row('US1.02', ['US1.01'])];

    expect(planProblems(cycle, cycle)).toEqual([
      expect.objectContaining({
        kind: 'cycle',
        message: expect.stringContaining('#US1.01 depends on #US1.02') as unknown,
      }),
    ]);

    expect(planProblems(ordered, ordered)).toEqual([]);
  });
});
