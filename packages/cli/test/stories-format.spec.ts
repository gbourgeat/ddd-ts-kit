import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeRepositoryOf } from '../src/merge/lost/merge-repository-of';
import { forecastMerge } from '../src/stories/forecast-merge';
import { formatStories } from '../src/stories/format-stories';
import { readStories } from '../src/stories/read-stories';
import type { StoryState } from '../src/stories/story-state';
import { tempDir, write } from './helpers';
import { git } from './support/git';

const BASE = { base: 'main', files: [] } as const;

const DETACHED: StoryState = { ...BASE, story: 'US8', worktree: '/repo/shop-us8', contexts: [] };

const CLEAN: StoryState = {
  ...BASE,
  story: 'US9',
  worktree: '/repo/shop-us9',
  branch: 'story/us9',
  contexts: ['billing'],
  trunk: { ref: 'main', behind: 0, settled: [], byHand: [] },
};

describe('the open stories, in text', () => {
  it('from the checkout of the trunk: the last fetch, a story without a branch or rows, a trunk merged in', () => {
    const text = formatStories(
      { stories: [DETACHED, CLEAN], crossings: [], fetched: '2026-10-18T09:00:00.000Z' },
      '/repo',
    );

    expect(text).toContain('Open stories (2); the trunk as fetched 2026-10-18T09:00:00.000Z');
    expect(text).toContain('US8  shop-us8  detached  no row yet, 0 file(s) changed');
    expect(text).toContain('US9  shop-us9  story/us9  contexts billing, 0 file(s) changed; main merged in');
    expect(text).toContain('No two of them meet.');
    expect(text).not.toContain('Next:');
  });

  it('a pair that meets on a context only, and a merge whose conflicts merge-trunk settles alone', () => {
    const text = formatStories(
      {
        here: 'US9',
        stories: [CLEAN, { ...CLEAN, story: 'US10', worktree: '/repo', branch: 'story/us10' }],
        crossings: [
          { stories: ['US9', 'US10'], contexts: ['billing'], files: [] },
          {
            stories: ['US9', 'US11'],
            contexts: [],
            files: [],
            merge: {
              ref: 'story/us11',
              behind: 2,
              settled: [{ file: 'docs/context-map.md', kind: 'mixed' }],
              byHand: [],
            },
          },
          {
            stories: ['US9', 'US12'],
            contexts: [],
            files: [],
            merge: { ref: 'story/us12', behind: 3, settled: [], byHand: [] },
          },
        ],
      },
      '/repo',
    );

    expect(text).toContain('US10  .  story/us10');
    expect(text).toContain('  US9 and US10\n    contexts both change: billing\n  US9 and US11');

    expect(text).toContain(
      'US11 merged into US9 now: 2 commit(s) of story/us11 to merge in, 1 conflict(s): 1 settled by merge-trunk',
    );

    expect(text).toContain('US12 merged into US9 now: 3 commit(s) of story/us12 to merge in, no conflict');
    expect(text).toContain('Next: no conflict yet;');
    expect(text).not.toContain('Next: bring the trunk in');
  });
});

describe('a merge forecast', () => {
  it('is none for a ref that names no commit, and empty for a branch that holds the other', () => {
    const root = tempDir('forecast');

    write(root, 'a.txt', 'a\n');
    git(root, 'init', '--quiet', '--initial-branch', 'main');
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'chore: a');

    const repo = mergeRepositoryOf(root);

    expect(forecastMerge(repo, { ours: 'main', theirs: 'nowhere' })).toBeUndefined();

    expect(forecastMerge(repo, { ours: 'main', theirs: 'main' })).toEqual({
      ref: 'main',
      behind: 0,
      settled: [],
      byHand: [],
    });
  });

  it('is none when git cannot compute the merge, as of a branch that shares no history', () => {
    const root = tempDir('forecast');

    write(root, 'a.txt', 'a\n');
    git(root, 'init', '--quiet', '--initial-branch', 'main');
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'chore: a');
    git(root, 'checkout', '--quiet', '--orphan', 'elsewhere');
    git(root, 'commit', '--quiet', '--allow-empty', '--message', 'chore: another history');
    git(root, 'checkout', '--quiet', 'main');

    expect(forecastMerge(mergeRepositoryOf(root), { ours: 'main', theirs: 'elsewhere' })).toBeUndefined();
  });
});

describe('a story on a detached HEAD, in a repository without slices', () => {
  it('has no rows, no trunk forecast and meets nothing', () => {
    const root = path.join(fs.realpathSync(tempDir('detached')), 'shop');
    const worktree = `${root}-us8`;

    fs.mkdirSync(root);
    write(root, '.gitignore', '.ddd-ts-kit/\n');
    git(root, 'init', '--quiet', '--initial-branch', 'main');
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'chore: bootstrap');
    git(root, 'worktree', 'add', '--quiet', '--detach', worktree);
    write(worktree, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US8', base: 'main' }));
    git(root, 'worktree', 'add', '--quiet', '--detach', `${root}-us9`);
    write(`${root}-us9`, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US9', base: 'main' }));

    const view = readStories(worktree);

    expect(view.here).toBe('US8');

    expect(view.stories).toEqual([
      { story: 'US8', worktree, base: 'main', contexts: [], files: [] },
      { story: 'US9', worktree: `${root}-us9`, base: 'main', contexts: [], files: [] },
    ]);

    expect(view.crossings).toEqual([]);
  });
});
