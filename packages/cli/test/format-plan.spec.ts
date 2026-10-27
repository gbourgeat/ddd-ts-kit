import { describe, expect, it } from 'vitest';
import { formatPlan } from '../src/plan/format-plan';
import type { Batch, PlannedRow, WavePlan } from '../src/plan/wave-plan';

const BATCH: Batch = {
  id: 'W1-B1',
  owner: 'conductor',
  context: 'billing',
  rows: [
    {
      id: '1',
      kind: 'command',
      slice: 'Issue an invoice',
      status: 'todo',
      story: null,
      waitingFor: [],
      waitingForRows: [],
    },
  ],
  aggregates: ['Invoice'],
  brief: null,
  sameFiles: [],
  unknownOverlap: [],
};

function planOf(overrides: Partial<WavePlan>): WavePlan {
  return {
    file: 'docs/architecture/slices.md',
    context: null,
    problems: [],
    waves: [],
    mergeOrder: [],
    otherStories: [],
    notReplayed: [],
    ...overrides,
  };
}

describe('plan-waves for a reader', () => {
  it('says the names to define first when only words are refused, then the commands refused for another reason', () => {
    const text = formatPlan(
      planOf({
        problems: [
          { kind: 'undefined-word', rows: ['2'], message: '#2 `generate command billing RefundInvoice`: ...' },
        ],
        notReplayed: [
          {
            row: '3',
            command: 'generate command billing PayInvoice --aggregate Order',
            refusal: 'No aggregate Order.',
          },
        ],
      }),
    );

    expect(text.split('\n')).toEqual([
      'Waves (docs/architecture/slices.md): none, the generator refuses names of these rows: add their terms first',
      '  #2 `generate command billing RefundInvoice`: ...',
      'Refused for another reason than a word when the plan was replayed (the names after the refusal not judged):',
      '  #3 `generate command billing PayInvoice --aggregate Order`: No aggregate Order.',
    ]);
  });

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

  it('names the context and the story of a row waited for only when it is outside the context shown or of another story', () => {
    const row: PlannedRow = {
      id: 'M1.03',
      kind: 'slice',
      slice: 'Book a slot',
      status: 'todo',
      story: 'M1',
      waitingFor: ['M1.01', 'M1.02', '7'],
      waitingForRows: [
        { id: 'M1.01', context: 'scheduling', story: 'M1', status: 'in progress' },
        { id: 'M1.02', context: 'calendar', story: 'M1', status: 'todo' },
        { id: '7', context: 'scheduling', story: null, status: 'todo' },
      ],
    };

    const text = formatPlan(
      planOf({
        context: 'scheduling',
        waves: [{ wave: 2, batches: [{ ...BATCH, rows: [row] }] }],
        mergeOrder: ['W1-B1'],
      }),
    );

    expect(text).toContain(
      '    #M1.03 slice "Book a slot", after #M1.01 (in progress), #M1.02 (todo, calendar, story M1), #7 (todo, scheduling, no story)\n',
    );
  });

  it('lists the rows another story waits for, a row of no story without one', () => {
    const text = formatPlan(
      planOf({
        waves: [{ wave: 1, batches: [BATCH] }],
        mergeOrder: ['W1-B1'],
        otherStories: [
          {
            id: '7',
            context: 'scheduling',
            story: null,
            kind: 'slice',
            slice: 'Open a calendar',
            owner: 'alice',
            status: 'in progress',
            batch: 'W1-B1',
            waitedForBy: ['M1.03', 'M2.01'],
          },
        ],
      }),
    );

    expect(text).toContain(
      'Rows another story waits for, not done\n  #7 scheduling slice "Open a calendar" (owner alice, in progress): in W1-B1, waited for by #M1.03, #M2.01\nMerge order',
    );
  });
});
