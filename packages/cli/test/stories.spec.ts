import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatStories } from '../src/stories/format-stories';
import { readStories } from '../src/stories/read-stories';
import { trunkPhase } from '../src/stories/trunk-phase';
import { Workspace } from '../src/workspace';
import { cli, tempDir, write } from './helpers';
import { git } from './support/git';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US5.01 | ordering | slice | Place order | | | ordering | todo |
| US6.01 | ordering | slice | Cancel order | | | ordering | todo |
| US7.01 | billing | slice | Issue invoice | | | billing | todo |
`;

const ORDER = 'src/contexts/ordering/domain/aggregates/order.aggregate.ts';
const DECLARATIONS = 'src/contexts/ordering/ordering.declarations.ts';
const INVOICE = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';

let root: string;
const worktrees: Record<string, string> = {};

/** Opens the worktree of a story on its branch from main, as story-scope leaves it, and commits its changes. */
function openStory(code: string, files: Readonly<Record<string, string>>): string {
  const worktree = path.join(path.dirname(root), `shop-${code}`);

  git(root, 'worktree', 'add', '--quiet', '-b', `story/${code}`, worktree);

  write(
    worktree,
    '.ddd-ts-kit/story.json',
    JSON.stringify({ story: code.toUpperCase(), base: 'main', branch: `story/${code}` }),
  );

  for (const [file, text] of Object.entries(files)) {
    write(worktree, file, text);
  }

  git(worktree, 'add', '--all');
  git(worktree, 'commit', '--quiet', '--message', `feat: ${code}`);

  return worktree;
}

// Three stories cut from main: US5 and US6 change the same aggregate and the same derived barrel,
// US7 another context; then main changes the aggregate too.
beforeAll(() => {
  root = path.join(fs.realpathSync(tempDir('stories')), 'shop');
  fs.mkdirSync(root);
  write(root, '.gitignore', '.ddd-ts-kit/\n');
  write(root, 'docs/architecture/slices.md', SLICES);
  write(root, ORDER, 'export const lines = 1;\n');
  write(root, DECLARATIONS, 'export const declared = [];\n');
  write(root, INVOICE, 'export const total = 0;\n');
  git(root, 'init', '--quiet', '--initial-branch', 'main');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'chore: bootstrap');

  worktrees['us5'] = openStory('us5', {
    [ORDER]: 'export const lines = 5;\n',
    [DECLARATIONS]: 'export const declared = [5];\n',
  });

  worktrees['us6'] = openStory('us6', {
    [ORDER]: 'export const lines = 6;\n',
    [DECLARATIONS]: 'export const declared = [6];\n',
  });

  worktrees['us7'] = openStory('us7', { [INVOICE]: 'export const total = 7;\n' });
  write(worktrees['us5'] ?? '', 'docs/notes.md', 'US5\n');
  write(worktrees['us6'] ?? '', 'docs/notes.md', 'US6\n');

  write(root, ORDER, 'export const lines = 2;\n');
  git(root, 'commit', '--quiet', '--all', '--message', 'feat: the trunk moves');
});

describe('stories', () => {
  it('from the worktree of a story, names the stories it meets: contexts, files both change, the conflicts of their merge', () => {
    const view = readStories(worktrees['us5'] ?? '');

    expect(view.here).toBe('US5');
    expect(view.stories.map(({ story }) => story)).toEqual(['US5', 'US6', 'US7']);

    expect(view.crossings).toEqual([
      {
        stories: ['US5', 'US6'],
        contexts: ['ordering'],
        files: ['docs/notes.md', ORDER],
        merge: {
          ref: 'story/us6',
          behind: 1,
          settled: [{ file: DECLARATIONS, kind: 'derived' }],
          byHand: [{ file: ORDER, kind: 'source' }],
        },
      },
    ]);

    expect(view.fetched).toBeUndefined();
  });

  it('says how far each story is behind its trunk, and what merging it in leaves to a person', () => {
    const view = readStories(worktrees['us5'] ?? '');

    expect(view.stories.find(({ story }) => story === 'US5')?.trunk).toEqual({
      ref: 'main',
      behind: 1,
      settled: [],
      byHand: [{ file: ORDER, kind: 'source' }],
    });

    expect(view.stories.find(({ story }) => story === 'US7')?.trunk).toMatchObject({ behind: 1, byHand: [] });
    expect(view.stories.find(({ story }) => story === 'US7')?.files).toEqual([INVOICE]);
  });

  it('from the checkout of the trunk, names every pair that meets', () => {
    const view = readStories(root);

    expect(view.here).toBeUndefined();
    expect(view.crossings.map(({ stories }) => stories)).toEqual([['US5', 'US6']]);
  });

  it('prints the stories, where they meet and what to do, in text', () => {
    const text = formatStories(readStories(worktrees['us5'] ?? ''), worktrees['us5'] ?? '');

    expect(text).toContain(
      'Open stories (3), this worktree takes US5; the trunk as this repository holds it, never fetched',
    );

    expect(text).toContain(
      `US6  ../shop-us6  story/us6  contexts ordering, 3 file(s) changed; 1 commit(s) of main to merge in, 1 conflict(s): 0 settled by merge-trunk, 1 for you (${ORDER})`,
    );

    expect(text).toContain(`    files both change: docs/notes.md, ${ORDER}`);

    expect(text).toContain(
      `    US6 merged into US5 now: 1 commit(s) of story/us6 to merge in, 2 conflict(s): 1 settled by merge-trunk, 1 for you (${ORDER})`,
    );

    expect(text).toContain('Next: bring the trunk in now');
    expect(text).toContain('Next: a conflict for you between two stories is settled by the second to land');
    expect(formatStories(readStories(worktrees['us7'] ?? ''), root)).toContain('US7 meets no other open story.');
    expect(formatStories({ stories: [], crossings: [] }, root)).toContain('No story is open');
  });

  it('runs from the command line, in JSON', () => {
    const result = cli(worktrees['us7'] ?? '', 'stories', '--json');

    expect(result.code).toBe(0);
    expect(result.json()).toMatchObject({ here: 'US7', crossings: [] });
  });
});

describe('the trunk phase of a story', () => {
  it('is met once the base is merged in, read in the worktree of the story only', () => {
    expect(trunkPhase(new Workspace(worktrees['us5'] ?? '', false), 'US5')).toMatchObject({
      met: false,
      detail: '1 commit(s) of main not merged in',
      gate: 'close',
    });

    expect(trunkPhase(new Workspace(root, false), 'US5')).toMatchObject({
      met: true,
      detail: 'read in the worktree of the story',
    });

    git(worktrees['us7'] ?? '', 'merge', '--quiet', '--no-edit', 'main');

    expect(trunkPhase(new Workspace(worktrees['us7'] ?? '', false), 'US7')).toMatchObject({
      met: true,
      detail: 'main merged in',
    });
  });

  it('says when the base names no commit', () => {
    const us6 = worktrees['us6'] ?? '';

    write(us6, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US6', base: 'gone', branch: 'story/us6' }));

    expect(trunkPhase(new Workspace(us6, false), 'US6')).toMatchObject({ met: false, detail: 'gone names no commit' });
  });

  it('is read elsewhere when the file of the story names no story or no base', () => {
    const us6 = worktrees['us6'] ?? '';

    write(us6, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US6', branch: 'story/us6' }));

    expect(trunkPhase(new Workspace(us6, false), 'US6')).toMatchObject({
      met: true,
      detail: 'read in the worktree of the story',
    });
  });
});
