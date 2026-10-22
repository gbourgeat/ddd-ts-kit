import { criteriaIn } from '../acceptance/criteria-in.js';
import { countsFor } from '../acceptance/counts-for.js';
import { readAcceptance } from '../acceptance/read-acceptance.js';
import { storyFileOf } from '../acceptance/story-file-of.js';
import { storyOfRow } from '../acceptance/story-of-row.js';
import type { StoryAcceptance } from '../acceptance/story-acceptance.js';
import type { Slice } from '../progress/slice.js';
import type { Workspace } from '../workspace/index.js';
import { readStoryClosing } from '../story/read-story-closing.js';
import { originPhase } from './origin-phase.js';
import { reviewFileOf } from './review-file-of.js';
import { sectionOf } from './section-of.js';
import { trunkPhase } from './trunk-phase.js';
import type { StoryPhase } from './story-phase.js';

/** A design review section of a row: `## #US5.02 Place order`. */
const ROW_HEADING = /^##\s+#(\S+)/gm;

/** What the phases of a story read. */
interface StoryFacts {
  readonly ws: Workspace;
  readonly story: string;
  readonly rows: readonly Slice[];
  readonly specification: string | undefined;
  readonly acceptance: StoryAcceptance | undefined;
}

/**
 * The phases of a story, in order: its specification and criteria, its rows, the design review of
 * each row, its acceptance written and locked (the `build` gate: the code may start), then its rows
 * done, its acceptance passing, its trunk merged in, its origin recorded and its report (the
 * `close` gate).
 */
export function readStoryPhases(ws: Workspace, story: string, slices: readonly Slice[]): StoryPhase[] {
  const rows = slices.filter((row) => storyOfRow(row.id).toLowerCase() === story.toLowerCase());
  const specification = storyFileOf(ws, story);
  const [acceptance] = readAcceptance(ws, slices, story);
  const facts: StoryFacts = { ws, story, rows, specification, acceptance };

  return [
    specificationPhase(facts),
    rowsPhase(facts),
    designPhase(facts),
    acceptancePhase(facts, 'written'),
    builtPhase(facts),
    acceptancePhase(facts, 'passing'),
    trunkPhase(ws, story),
    originPhase(ws, story, specification),
    reportPhase(facts),
  ];
}

function specificationPhase({ ws, story, specification }: StoryFacts): StoryPhase {
  const criteria = specification === undefined ? [] : criteriaIn(ws.read(specification) ?? '');

  return {
    id: 'specification',
    title: 'specification',
    met: criteria.length > 0,
    detail:
      specification === undefined
        ? `no docs/architecture/stories/${story}.md`
        : `${specification}, ${criteria.length} acceptance criteria`,
    next: `Write docs/architecture/stories/${story}.md: the statement, the questions asked and their answers, and \`## Acceptance criteria\`, one \`- AC1: <what a client observes>\` each.`,
    gate: 'build',
  };
}

function rowsPhase({ story, rows }: StoryFacts): StoryPhase {
  return {
    id: 'rows',
    title: 'rows',
    met: rows.length > 0,
    detail: `${rows.length} row${rows.length === 1 ? '' : 's'} in docs/architecture/slices.md`,
    next: `Plan the rows of ${story} in docs/architecture/slices.md (skill ddd-ts-kit:plan-slices), numbered ${story}.01, ${story}.02.`,
    gate: 'build',
  };
}

function designPhase({ ws, story, rows }: StoryFacts): StoryPhase {
  const file = reviewFileOf(ws, story);
  const reviewed = new Set([...(ws.read(file ?? '') ?? '').matchAll(ROW_HEADING)].map(([, id]) => id));
  const missing = rows.filter((row) => row.status !== 'done' && !reviewed.has(row.id)).map((row) => `#${row.id}`);

  return {
    id: 'design',
    title: 'design review',
    met: rows.length > 0 && missing.length === 0,
    detail:
      file === undefined
        ? `no docs/architecture/reviews/${story}.md`
        : missing.length === 0
          ? `${file}, a section per row`
          : `${file} has no section for ${missing.join(', ')}`,
    next: `Write the design of each row in docs/architecture/reviews/${story}.md, one \`## #<id> <slice>\` section each, have the architecture-reviewer agent read it as a design review, and settle its findings.`,
    gate: 'build',
  };
}

/** What each acceptance gate is called and asks for, by the gate of the story it belongs to. */
const ACCEPTANCE_PHASES = {
  written: {
    id: 'acceptance',
    title: 'acceptance written and locked',
    next: (story: string) =>
      `Write the acceptance of ${story} before its code (skill ddd-ts-kit:testing), then \`npx ddd-ts-kit acceptance ${story} --lock\`; \`npx ddd-ts-kit acceptance ${story} --gate written\` lists what is left.`,
    gate: 'build',
  },
  passing: {
    id: 'passing',
    title: 'acceptance passing',
    next: (story: string) =>
      `Build what the pending scenarios wait for; \`npx ddd-ts-kit acceptance ${story} --gate passing\` lists them.`,
    gate: 'close',
  },
} as const;

function acceptancePhase({ story, acceptance }: StoryFacts, gate: 'written' | 'passing'): StoryPhase {
  const left = acceptance?.problems.filter((problem) => countsFor(problem, gate)) ?? [];
  const { id, title, next, gate: storyGate } = ACCEPTANCE_PHASES[gate];

  return {
    id,
    title,
    met: acceptance !== undefined && left.length === 0,
    detail: left.length === 0 ? 'met' : `${left.length} left: ${left[0]?.message ?? ''}`,
    next: next(story),
    gate: storyGate,
  };
}

/** Its rows done and no marker of its own left, as `story-check` says. */
function builtPhase({ ws, story, rows }: StoryFacts): StoryPhase {
  const [next] = rows.filter((row) => row.status !== 'done');

  if (next !== undefined) {
    const done = rows.filter((row) => row.status === 'done').length;

    return {
      ...BUILT,
      met: false,
      detail: `${done} of ${rows.length} done, next #${next.id} ${next.slice}`,
      next: 'Build the next row: contracts and skeletons yourself, each slice with `npx ddd-ts-kit worker-scope <context> --here --rows <id>` and one context-builder agent; mark it done once verified and committed.',
    };
  }

  const markers = rows.length === 0 ? 0 : markersLeft(ws, story);

  const left =
    markers === 0
      ? ''
      : `, ${markers} marker${markers === 1 ? '' : 's'} of its own left (\`npx ddd-ts-kit story-check ${story}\`)`;

  return {
    ...BUILT,
    met: rows.length > 0 && markers === 0,
    detail: `${rows.length} of ${rows.length} done${left}`,
    next: `Settle each marker \`npx ddd-ts-kit story-check ${story}\` lists, as it says.`,
  };
}

const BUILT = { id: 'built', title: 'rows done', gate: 'close' } as const;

/** The markers that keep the story open; none when they cannot be read. */
function markersLeft(ws: Workspace, story: string): number {
  try {
    return readStoryClosing(ws.root, story, false).markers.length;
  } catch {
    return 0;
  }
}

function reportPhase({ ws, story, specification }: StoryFacts): StoryPhase {
  const report = specification === undefined ? undefined : sectionOf(ws.read(specification) ?? '', 'Report');

  return {
    id: 'report',
    title: 'report',
    met: report !== undefined && report.trim() !== '',
    detail: report === undefined ? 'no `## Report` in the specification' : 'written',
    next: `Write \`## Report\` in docs/architecture/stories/${story}.md: each provisional decision, each compromise, each amendment of the acceptance, what is left; it is the body of the pull request.`,
    gate: 'close',
  };
}
