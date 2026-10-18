import path from 'node:path';
import type { MergeForecast } from './merge-forecast.js';
import type { StoriesView } from './stories-view.js';
import type { StoryCrossing } from './story-crossing.js';
import type { StoryState } from './story-state.js';

/** The open stories as text: one line each, where they meet, and what to do about it. */
export function formatStories(view: StoriesView, cwd: string): string {
  if (view.stories.length === 0) {
    return 'No story is open in a worktree of this repository (`npx ddd-ts-kit story-scope <code>` opens one).';
  }

  return [
    `Open stories (${view.stories.length})${view.here === undefined ? '' : `, this worktree takes ${view.here}`}; the trunk as ${view.fetched === undefined ? 'this repository holds it, never fetched' : `fetched ${view.fetched}`} (\`git fetch\` brings it up to date)`,
    ...view.stories.map((story) => `  ${storyLine(story, cwd)}`),
    '',
    ...crossingsBlock(view),
    ...nextBlock(view),
  ].join('\n');
}

function storyLine(story: StoryState, cwd: string): string {
  const contexts = story.contexts.length === 0 ? 'no row yet' : `contexts ${story.contexts.join(', ')}`;
  const trunk = story.trunk === undefined ? '' : `; ${forecastText(story.trunk)}`;

  return `${story.story}  ${path.relative(cwd, story.worktree) || '.'}  ${story.branch ?? 'detached'}  ${contexts}, ${story.files.length} file(s) changed${trunk}`;
}

function crossingsBlock({ here, crossings }: StoriesView): string[] {
  if (crossings.length === 0) {
    return [here === undefined ? 'No two of them meet.' : `${here} meets no other open story.`, ''];
  }

  return ['Where they meet', ...crossings.flatMap((crossing) => crossingLines(crossing)), ''];
}

function crossingLines({ stories: [first, second], contexts, files, merge }: StoryCrossing): string[] {
  return [
    `  ${first} and ${second}`,
    ...(contexts.length === 0 ? [] : [`    contexts both change: ${contexts.join(', ')}`]),
    ...(files.length === 0 ? [] : [`    files both change: ${files.join(', ')}`]),
    ...(merge === undefined ? [] : [`    ${second} merged into ${first} now: ${forecastText(merge)}`]),
  ];
}

/** `3 commits of main behind, 2 conflicts: 1 settled by merge-trunk, 1 for you (src/a.ts)`. */
function forecastText({ ref, behind, settled, byHand }: MergeForecast): string {
  if (behind === 0) {
    return `${ref} merged in`;
  }

  const conflicts = settled.length + byHand.length;
  const forYou = byHand.length === 0 ? '' : `, ${byHand.length} for you (${byHand.map(({ file }) => file).join(', ')})`;

  return `${behind} commit(s) of ${ref} to merge in, ${conflicts === 0 ? 'no conflict' : `${conflicts} conflict(s): ${settled.length} settled by merge-trunk${forYou}`}`;
}

function nextBlock(view: StoriesView): string[] {
  return [...trunkAdvice(view), ...crossingAdvice(view)];
}

function trunkAdvice({ here, stories }: StoriesView): string[] {
  const trunk = stories.find((story) => story.story === here)?.trunk;

  return trunk === undefined || trunk.byHand.length === 0
    ? []
    : [
        `Next: bring the trunk in now, while its conflicts are few: commit, then \`npx ddd-ts-kit merge-trunk --trunk ${trunk.ref}\`.`,
      ];
}

function crossingAdvice({ crossings }: StoriesView): string[] {
  if (crossings.some((crossing) => (crossing.merge?.byHand.length ?? 0) > 0)) {
    return [
      'Next: a conflict for you between two stories is settled by the second to land, once the first is on the trunk (`merge-trunk`): keep off its files when the rows allow it, else record which story lands first as a decision of the report.',
    ];
  }

  return crossings.some((crossing) => crossing.files.length > 0 || crossing.contexts.length > 0)
    ? [
        'Next: no conflict yet; read the rows and the design review of the other story before changing what both change, and keep off its aggregates when the rows allow it.',
      ]
    : [];
}
