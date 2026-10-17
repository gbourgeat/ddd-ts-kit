import type { Slice } from '../progress/slice.js';
import type { Workspace } from '../workspace/index.js';
import { ACCEPTANCE_DIR, acceptanceFileOf } from './acceptance-file-of.js';
import { criteriaIn } from './criteria-in.js';
import { lockFileOf } from './lock-file-of.js';
import { readLock } from './read-lock.js';
import { lockProblems } from './lock-problems.js';
import type { Scenario } from './scenario.js';
import { scenarioProblems } from './scenario-problems.js';
import { scenariosIn } from './scenarios-in.js';
import type { RowAcceptance, StoryAcceptance } from './story-acceptance.js';
import { storyFileOf } from './story-file-of.js';
import { storyOfFile } from './story-of-file.js';
import { storyOfRow } from './story-of-row.js';
import { storyProblems } from './story-problems.js';

/**
 * The acceptance of every story of slices.md and of every acceptance spec, in the order of the
 * file then of the specs; of one story when `only` names it, in any case.
 */
export function readAcceptance(ws: Workspace, slices: readonly Slice[], only?: string): StoryAcceptance[] {
  const files = ws.list(ACCEPTANCE_DIR).flatMap((name) => storyOfFile(name) ?? []);
  const stories = once([...slices.map((row) => storyOfRow(row.id)), ...files]);

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

function acceptanceOf(ws: Workspace, story: string, slices: readonly Slice[]): StoryAcceptance {
  const file = acceptanceFileOf(story);
  const text = ws.read(file);
  const scenarios = text === undefined ? [] : scenariosIn(text);
  const specification = storyFileOf(ws, story);
  const criteria = specification === undefined ? [] : criteriaIn(ws.read(specification) ?? '');
  const lock = readLock(ws, story);

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
    ...(lock === undefined ? {} : { lock: lockFileOf(story) }),
    amendments: lock?.amendments ?? [],
    problems: [
      ...storyProblems({ story, file, text, rows, criteria, scenarios, specification }),
      ...scenarios.flatMap((scenario) => scenarioProblems(scenario, context)),
      ...lockProblems({ story, lock, scenarios, criteria }),
    ],
  };
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
