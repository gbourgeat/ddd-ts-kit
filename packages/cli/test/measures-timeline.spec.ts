import { describe, expect, it } from 'vitest';
import type { BranchCommit } from '../src/measures/branch-commit';
import type { StoryHistory } from '../src/measures/story-history';
import { timelineOf } from '../src/measures/timeline-of';

const REPORTED: BranchCommit = {
  sha: 'c0ffee0',
  parents: [],
  at: Date.UTC(2026, 2, 2),
  author: 'Ada',
  subject: 'docs(story): report',
  slices: [],
  files: [],
};

const HISTORY: StoryHistory = {
  files: { story: 'US1', file: 'US1.md', lock: 'US1.lock', acceptance: 'US1.spec.ts' },
  commits: { all: [REPORTED], ofStoryFile: [REPORTED] },
};

describe('the timeline of a story', () => {
  it('has no close when the branch it is read against holds no commit', () => {
    const repository = { root: '.', git: (): string => '## Report\n\ndone.\n' };

    expect(timelineOf(repository, HISTORY, [])).toEqual({ opened: '2026-03-02T00:00:00.000Z', author: 'Ada' });
  });
});
