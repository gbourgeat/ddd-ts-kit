import { describe, expect, it } from 'vitest';
import type { Remaining } from '../src/progress/remaining';
import type { Slice } from '../src/progress/slice';
import { closingOf } from '../src/story/closing-of';
import { formatStoryClosing } from '../src/story/format-story-closing';
import type { AttributedMarker, MarkerAttribution } from '../src/story/attributed-marker';
import { storyOf } from '../src/story/story-of';
import { unclosedStories } from '../src/story/unclosed-stories';

const row = (id: string, context: string, status: string): Slice => ({
  id,
  context,
  kind: 'slice',
  slice: `Slice ${id}`,
  startWith: '',
  dependsOn: [],
  owner: context,
  status,
});

const NONE: MarkerAttribution = { by: 'none', rows: [] };

const marker = (kind: Remaining['kind'], at: string, attribution: MarkerAttribution = NONE): AttributedMarker => {
  const [context = '', file = ''] = at.split(':');

  return { kind, context, file, line: 3, text: `a ${kind} marker`, attribution };
};

const ROWS = [
  row('M1.01', 'billing', 'done'),
  row('M1.02', 'payments', 'done'),
  row('M1.03', 'all', 'done'),
  row('US2.01', 'billing', 'in progress'),
  row('US2.02', 'catalog', 'todo'),
  row('US3.01', 'catalog', 'done'),
  row('7', 'billing', 'todo'),
];

const CONTEXTS = ['billing', 'catalog', 'payments'];
const INVOICE = 'billing:src/contexts/billing/domain/invoice.aggregate.ts';
const PAYMENT = 'payments:src/contexts/payments/domain/payment.aggregate.ts';
const PRODUCT = 'catalog:src/contexts/catalog/domain/product.aggregate.ts';
const PLATFORM = ':src/platform/auth/relationships/relation-tuples.ts';
const BY_COMMIT: MarkerAttribution = { by: 'commit', rows: ['M1.01'], commit: { sha: '2443af2', trailer: true } };

const closing = (story: string, markers: readonly AttributedMarker[], strict = false) =>
  closingOf(story, { rows: ROWS, markers, contexts: CONTEXTS }, strict);

describe('the story of a row', () => {
  it('is the id without its last .<number>', () => {
    expect(storyOf('M1.03')).toBe('M1');
    expect(storyOf('US5.12')).toBe('US5');
    expect(storyOf('D4.01')).toBe('D4');
    expect(storyOf('4.15')).toBe('4');
    expect(storyOf('R2.1.04')).toBe('R2.1');
  });

  it('is none for a bare number or a code alone', () => {
    expect(storyOf('12')).toBeUndefined();
    expect(storyOf('M1')).toBeUndefined();
    expect(storyOf('M1.')).toBeUndefined();
  });
});

describe('whether a story can close', () => {
  it('can when every row is done and no marker of its own is left', () => {
    const closed = closing('M1', [marker('test', PRODUCT)]);

    expect(closed).toMatchObject({
      rows: ['M1.01', 'M1.02', 'M1.03'],
      contexts: ['billing', 'payments'],
      unread: ['all'],
    });

    expect(closed.canClose).toBe(true);

    expect(formatStoryClosing(closed)).toBe(
      'M1 can close: its 3 rows done, no marker of its own left in billing, payments.',
    );
  });

  it('lists the rows not done with their status', () => {
    const open = closing('US2', []);

    expect(open.open).toEqual([
      { id: 'US2.01', context: 'billing', slice: 'Slice US2.01', status: 'in progress' },
      { id: 'US2.02', context: 'catalog', slice: 'Slice US2.02', status: 'todo' },
    ]);

    expect(formatStoryClosing(open)).toContain('US2 cannot close: 2 rows not done, 0 markers of its own left.');
    expect(formatStoryClosing(open)).toContain('  #US2.01 billing "Slice US2.01": in progress');
  });

  it('is kept open by the markers of its own, wherever they are, each with why', () => {
    const markers = [
      marker('review', PRODUCT, { by: 'text', rows: ['M1.02', 'US2.02'] }),
      marker('domain', INVOICE, BY_COMMIT),
      marker('test', INVOICE, { by: 'commit', rows: ['M1.01'], commit: { sha: '9f00e1d', trailer: false } }),
      marker('platform', PLATFORM, { by: 'worker', rows: ['M1.03'] }),
      marker('platform', PLATFORM),
    ];

    const open = closing('M1', markers);

    expect(open.markers.map((left) => left.why)).toEqual([
      'names #M1.02',
      'written by 2443af2 Slice: M1.01',
      'written by 9f00e1d, whose message names #M1.01',
      'not committed, in the worktree of #M1.03',
    ]);

    expect(formatStoryClosing(open)).toContain('M1 cannot close: every row done, 4 markers of its own left.');

    expect(formatStoryClosing(open)).toContain(
      '  src/contexts/billing/domain/invoice.aggregate.ts:3  a domain marker  (written by 2443af2 Slice: M1.01)',
    );

    expect(formatStoryClosing(open)).toContain('it.todo (1): write the test, or dismiss it by a decision record');
    expect(formatStoryClosing(open)).toContain('Not a context of the project: all');
  });

  it('lists an unattributed marker of a context another open story works in, without blocking', () => {
    const closed = closing('M1', [
      marker('review', INVOICE),
      marker('domain', INVOICE, { by: 'text', rows: ['US2.01'] }),
    ]);

    expect(closed.canClose).toBe(true);

    expect(closed.unattributed.map((left) => [left.why, left.sharedWith])).toEqual([
      ['unattributed, may belong to open US2: settle it or name the row in the marker', ['US2']],
    ]);

    expect(closed.others).toHaveLength(1);

    expect(formatStoryClosing(closed)).toContain(
      '  src/contexts/billing/domain/invoice.aggregate.ts:3  TODO(review)  a review marker  (unattributed, may belong to open US2',
    );

    expect(formatStoryClosing(closed)).toContain('Not blocking: 1 marker of these contexts belongs to rows of US2.');
  });

  it('is kept open by an unattributed marker of a context no other open story works in', () => {
    const open = closing('M1', [marker('platform', PAYMENT), marker('platform', PLATFORM)]);

    expect(open.markers.map((left) => [left.file, left.why])).toEqual([
      ['src/contexts/payments/domain/payment.aggregate.ts', 'no other open story in payments'],
    ]);
  });

  it('is kept open by every marker of its contexts with strict', () => {
    const markers = [marker('review', INVOICE), marker('domain', INVOICE, { by: 'text', rows: ['US2.01'] })];
    const open = closing('M1', markers, true);

    expect(open.markers.map((left) => left.why)).toEqual(['in billing, --strict', 'in billing, --strict']);
    expect(formatStoryClosing(open)).toContain('--strict: every marker of its contexts keeps it open');
  });
});

describe('the stories status names', () => {
  it('are those whose rows are all done while markers of their own keep them open, attributed once', () => {
    const asked: Remaining[][] = [];

    const attribute = (markers: readonly Remaining[]): AttributedMarker[] => {
      asked.push([...markers]);

      return markers.map((left) => ({ ...left, attribution: left.context === 'billing' ? BY_COMMIT : NONE }));
    };

    const remaining = [marker('review', INVOICE), marker('domain', PRODUCT), marker('test', ':test/support/world.ts')];

    expect(unclosedStories({ rows: ROWS, remaining, contexts: CONTEXTS, attribute })).toEqual([
      { story: 'M1', markers: 1, command: 'npx ddd-ts-kit story-check M1' },
    ]);

    expect(asked).toHaveLength(1);
    expect(asked[0]?.map((left) => left.context)).toEqual(['billing', 'catalog', '']);
    expect(unclosedStories({ rows: ROWS.slice(3, 5), remaining, contexts: CONTEXTS, attribute })).toEqual([]);
    expect(asked).toHaveLength(1);
  });
});
