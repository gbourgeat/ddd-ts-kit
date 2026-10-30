import { describe, expect, it } from 'vitest';
import { formatProgress } from '../src/progress/format-progress';
import type { StatusRow } from '../src/progress/progress';

const ROW: StatusRow = {
  id: 'M1.02',
  context: 'billing',
  kind: 'slice',
  slice: 'Issue invoice',
  startWith: '',
  dependsOn: [],
  owner: 'billing',
  status: 'todo',
};

describe('the text of the progress', () => {
  it('says nothing of whether a row can start when the row does not say', () => {
    const text = formatProgress({
      next: null,
      planNext: null,
      remaining: [],
      slices: {
        file: 'docs/architecture/slices.md',
        rows: [ROW],
        byStatus: { todo: ['M1.02'] },
        byOwner: { billing: { todo: ['M1.02'] } },
        duplicates: [],
        unscoped: [],
        landedNotDone: [],
        unclosed: [],
      },
    });

    expect(text.split('\n')).toContain('    #M1.02 billing slice "Issue invoice" (owner billing)');
  });
});
