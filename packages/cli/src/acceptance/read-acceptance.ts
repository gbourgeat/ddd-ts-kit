import type { Slice } from '../progress/slice';
import type { Workspace } from '../workspace';
import { ACCEPTANCE_DIR, acceptanceFileOf } from './acceptance-file-of';
import type { AcceptanceProblem } from './acceptance-problem';
import { type Criterion, criteriaIn } from './criteria-in';
import { lockFileOf } from './lock-file-of';
import { previousLockOf } from './previous-lock-of';
import { readVerdicts } from './read-verdicts';
import { lockProblems } from './lock-problems';
import { readRegression } from './read-regression';
import { regressionFilesIn } from './regression-files-in';
import { regressionProblems } from './regression-problems';
import type { RegressionSpec } from './regression-spec';
import type { Scenario } from './scenario';
import { scenarioProblems } from './scenario-problems';
import { scenariosIn } from './scenarios-in';
import type { RowAcceptance, StoryAcceptance } from './story-acceptance';
import { STORIES_DIR, storyFileOf } from './story-file-of';
import { storyOfFile } from './story-of-file';
import { storyOfRow } from './story-of-row';
import { type StoryParts, storyProblems } from './story-problems';

/**
 * The acceptance of every story of slices.md, of every acceptance spec and of every fix (a story
 * file with a `## Regression` section), in the order of the file, of the specs, then of the
 * fixes; of one story when `only` names it, in any case.
 */
export function readAcceptance(ws: Workspace, slices: readonly Slice[], only?: string): StoryAcceptance[] {
  const files = ws.list(ACCEPTANCE_DIR).flatMap((name) => storyOfFile(name) ?? []);
  const stories = once([...slices.map((row) => storyOfRow(row.id)), ...files, ...fixesIn(ws)]);

  return stories
    .filter((story) => only === undefined || story.toLowerCase() === only.toLowerCase())
    .map((story) => acceptanceOf(ws, story, slices));
}

/** Each story once, as its rows write it when they do. */
function once(stories: readonly string[]): string[] {
  const seen = new Set<string>();

  return stories.filter((story) => {
    const key = story.toLowerCase();
    const isNew = !seen.has(key);

    seen.add(key);

    return isNew;
  });
}

/** The fixes of the project: each story file whose `## Regression` section lists the specs that prove it, named after the file. */
function fixesIn(ws: Workspace): string[] {
  return ws
    .list(STORIES_DIR)
    .filter((name) => name.endsWith('.md') && regressionFilesIn(ws.read(`${STORIES_DIR}/${name}`) ?? '') !== undefined)
    .map((name) => name.slice(0, -'.md'.length));
}

function acceptanceOf(ws: Workspace, story: string, slices: readonly Slice[]): StoryAcceptance {
  const file = acceptanceFileOf(story);
  const text = ws.read(file);
  const scenarios = text === undefined ? [] : scenariosIn(text);
  const { specification, criteria, regression } = specificationOf(ws, story);
  const previous = previousLockOf(ws, story);
  const lock = 'lock' in previous ? previous.lock : undefined;

  const rows = rowsOf(story, slices, scenarios);

  const context = {
    file,
    knownRows: new Set(slices.map((row) => row.id)),
    doneRows: new Set(slices.filter((row) => row.status === 'done').map((row) => row.id)),
    criteria: new Set(criteria.map(({ id }) => id)),
  };

  return {
    story,
    ...(text === undefined ? {} : { file }),
    ...(specification === undefined ? {} : { specification }),
    rows,
    criteria,
    scenarios,
    ...(regression === undefined ? {} : { regression }),
    ...(previous.kind === 'on-disk' ? { lock: lockFileOf(story) } : {}),
    amendments: lock?.amendments ?? [],
    problems: [
      ...wholeProblems(story, { file, text, rows, criteria, scenarios, specification, regression }),
      ...scenarios.flatMap((scenario) => scenarioProblems(scenario, context)),
      ...(previous.kind === 'committed' ? [removedProblem(story, previous.commit)] : []),
      ...lockProblems({ story, lock, scenarios, criteria, regression, verdicts: readVerdicts(ws, story) }),
    ],
  };
}

/** What the story file states: its criteria, and, for a fix, the regression specs it lists. */
interface Specification {
  readonly specification: string | undefined;
  readonly criteria: Criterion[];
  readonly regression: RegressionSpec[] | undefined;
}

function specificationOf(ws: Workspace, story: string): Specification {
  const specification = storyFileOf(ws, story);
  const statement = specification === undefined ? '' : (ws.read(specification) ?? '');
  const listed = regressionFilesIn(statement);

  return {
    specification,
    criteria: specification === undefined ? [] : criteriaIn(statement),
    regression: listed === undefined ? undefined : readRegression(ws, listed),
  };
}

/** The parts of a story, and the regression specs when it is a fix. */
interface WholeParts extends Omit<StoryParts, 'story'> {
  readonly regression: readonly RegressionSpec[] | undefined;
}

/** What the story lacks as a whole; a fix is held to its regression specs, not to rows nor to an acceptance spec. */
function wholeProblems(story: string, parts: WholeParts): AcceptanceProblem[] {
  const { regression, ...rest } = parts;

  return regression === undefined ? storyProblems({ story, ...rest }) : regressionProblems(story, regression);
}

/** The rows of the story in slices.md, each with the scenarios that name it. */
function rowsOf(story: string, slices: readonly Slice[], scenarios: readonly Scenario[]): RowAcceptance[] {
  return slices
    .filter((row) => storyOfRow(row.id).toLowerCase() === story.toLowerCase())
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      slice: row.slice,
      status: row.status,
      scenarios: scenarios.filter((scenario) => scenario.rows.includes(row.id)),
    }));
}

/** A lock a commit holds that the disk no longer does: restoring it is the first step. */
function removedProblem(story: string, commit: string): AcceptanceProblem {
  return {
    kind: 'drift',
    at: lockFileOf(story),
    message: `The lock of ${story} was removed or emptied: restore it (\`git checkout ${commit.slice(0, 8)} -- ${lockFileOf(story)}\`), then lock again once the changes since have their verdicts.`,
  };
}
