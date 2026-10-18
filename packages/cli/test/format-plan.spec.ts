import { describe, expect, it } from 'vitest';
import { formatPlan } from '../src/plan/format-plan.js';
import type { Batch, WavePlan } from '../src/plan/wave-plan.js';

const BATCH: Batch = {
  id: 'W1-B1',
  owner: 'conductor',
  context: 'billing',
  rows: [{ id: '1', kind: 'command', slice: 'Issue an invoice', status: 'todo', waitingFor: [] }],
  aggregates: ['Invoice'],
  brief: null,
  sameFiles: [],
  unknownOverlap: [],
};

function planOf(overrides: Partial<WavePlan>): WavePlan {
  return { file: 'docs/architecture/slices.md', context: null, problems: [], waves: [], mergeOrder: [], ...overrides };
}

describe('plan-waves for a reader', () => {
  it('says every row is done when no batch is left', () => {
    expect(formatPlan(planOf({ waves: [{ wave: 1, batches: [] }] }))).toBe(
      'Waves (docs/architecture/slices.md): none, every row is done',
    );
  });

  it('names the context it was asked for, one wave and one batch in the singular', () => {
    const text = formatPlan(
      planOf({ context: 'billing', waves: [{ wave: 1, batches: [BATCH] }], mergeOrder: ['W1-B1'] }),
    );

    expect(text.split('\n').slice(0, 5)).toEqual([
      'Waves (docs/architecture/slices.md, context billing): 1 rows not done, 1 wave, 1 batch',
      'Wave 1',
      '  W1-B1 conductor, billing (aggregate Invoice)',
      '    #1 command "Issue an invoice"',
      '    on the trunk, by the conductor',
    ]);
  });

  it('says to brief by hand an owner that is neither the conductor nor a context', () => {
    const batch: Batch = { ...BATCH, owner: 'alice', aggregates: [] };
    const text = formatPlan(planOf({ waves: [{ wave: 1, batches: [batch, { ...batch, id: 'W1-B2' }] }] }));

    expect(text).toContain('2 rows not done, 1 wave, 2 batches');
    expect(text).toContain('  W1-B1 alice, billing (aggregate unknown)');
    expect(text).toContain('    brief alice by hand: worker-scope briefs the worker of a context');
  });
});
