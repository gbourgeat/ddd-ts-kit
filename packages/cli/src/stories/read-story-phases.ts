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
import { readStoryPlace } from './read-story-place.js';
import { regressionPhase } from './regression-phase.js';
import { regressionSpecsIn } from './regression-specs-in.js';
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
  /** A fix: its rows and their design are optional, and `## Regression` stands for its acceptance. */
  readonly fix: boolean;
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
  const fix = isFix(ws, story, specification);
  const facts: StoryFacts = { ws, story, rows, specification, acceptance, fix };

  return [
    specificationPhase(facts),
    rowsPhase(facts),
    designPhase(facts),
    fix ? regressionPhase(ws, story, specification) : acceptancePhase(facts, 'written'),
    builtPhase(facts),
    ...(fix ? [] : [acceptancePhase(facts, 'passing')]),
    trunkPhase(ws, story),
    originPhase(ws, story, specification),
    reportPhase(facts),
  ];
}

/** A fix: opened with `story-scope --kind fix` (read in its worktree), or a specification with a `## Regression` section. */
function isFix(ws: Workspace, story: string, specification: string | undefined): boolean {
  const place = readStoryPlace(ws.root);

  if (place !== undefined && place.story.toLowerCase() === story.toLowerCase()) {
    return place.kind === 'fix';
  }

  return specification !== undefined && regressionSpecsIn(ws.read(specification) ?? '') !== undefined;
}

function specificationPhase({ ws, story, specification, fix }: StoryFacts): StoryPhase {
  const criteria = specification === undefined ? [] : criteriaIn(ws.read(specification) ?? '');

  return {
    id: 'specification',
    title: 'specification',
    met: criteria.length > 0 || (fix && specification !== undefined),
    detail:
      specification === undefined
        ? `no docs/architecture/stories/${story}.md`
        : `${specification}, ${criteria.length} acceptance criteria${fix ? ', a fix' : ''}`,
    next: `Write docs/architecture/stories/${story}.md: the statement, the questions asked and their answers, and \`## Acceptance criteria\`, one \`- AC1: <what a client observes>\` each.`,
    gate: 'build',
  };
}

function rowsPhase({ story, rows, fix }: StoryFacts): StoryPhase {
  return {
    id: 'rows',
    title: 'rows',
    met: rows.length > 0 || fix,
    detail:
      fix && rows.length === 0
        ? 'no row, optional for a fix'
        : `${rows.length} row${rows.length === 1 ? '' : 's'} in docs/architecture/slices.md`,
    next: `Plan the rows of ${story} in docs/architecture/slices.md (skill ddd-ts-kit:plan-slices), numbered ${story}.01, ${story}.02.`,
    gate: 'build',
  };
}

function designPhase({ ws, story, rows, fix }: StoryFacts): StoryPhase {
  const file = reviewFileOf(ws, story);
  const reviewed = new Set([...(ws.read(file ?? '') ?? '').matchAll(ROW_HEADING)].map(([, id]) => id));
  const missing = rows.filter((row) => row.status !== 'done' && !reviewed.has(row.id)).map((row) => `#${row.id}`);

  return {
    id: 'design',
    title: 'design review',
    met: (rows.length > 0 || fix) && missing.length === 0,
    detail:
      fix && rows.length === 0
        ? 'no row to design, optional for a fix'
        : file === undefined
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
function builtPhase({ ws, story, rows, fix }: StoryFacts): StoryPhase {
  const [next] = rows.filter((row) => row.status !== 'done');

  if (fix && rows.length === 0) {
    return {
      ...BUILT,
      met: true,
      detail: 'no row, optional for a fix: the fix is built in its commits',
      next: 'Build the fix behind its regression specs, one commit, then mark nothing: a fix without rows has no row to mark done.',
    };
  }

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

/** The evidence of the verification, under the report: `### Verification` naming the whole gate. */
const VERIFICATION = /^###\s+Verification\s*$[^]*?npm run verify/m;

function reportPhase({ ws, story, specification }: StoryFacts): StoryPhase {
  const report = specification === undefined ? undefined : sectionOf(ws.read(specification) ?? '', 'Report');
  const verified = report !== undefined && VERIFICATION.test(report);

  return {
    id: 'report',
    title: 'report',
    met: report !== undefined && report.trim() !== '' && verified,
    detail:
      report === undefined
        ? 'no `## Report` in the specification'
        : verified
          ? 'written, with its verification'
          : 'written, without `### Verification` naming `npm run verify`',
    next: `Write \`## Report\` in docs/architecture/stories/${story}.md: each provisional decision, each compromise, each amendment of the acceptance, what is left, and \`### Verification\` with the last lines of \`npm run verify\`, of the acceptance run and of \`story-check\`, and \`not verified:\` for what could not run; it is the body of the pull request.`,
    gate: 'close',
  };
}
