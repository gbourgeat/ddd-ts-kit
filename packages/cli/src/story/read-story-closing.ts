import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';
import { readConfig } from '../config/index.js';
import { readRemaining } from '../progress/read-remaining.js';
import { readSlices, SLICES_FILE } from '../progress/read-slices.js';
import type { Slice } from '../progress/slice.js';
import { Workspace } from '../workspace/index.js';
import { attributeMarkers } from './attribute-markers.js';
import { closingOf } from './closing-of.js';
import { designDepartures } from './design-departures.js';
import { mayKeepOpen } from './may-keep-open.js';
import { projectContexts } from './project-contexts.js';
import type { StoryClosing } from './story-closing.js';
import { storyOf } from './story-of.js';
import { storyScope } from './story-scope.js';

/**
 * Whether the story or milestone `asked` (`M1`, `#M1`) can close, read from the slices file, the
 * markers of the tree and, for the markers that may be its own, the commits that wrote them; and
 * from the design review of its done rows against the tree, each name cited there that the code
 * lacks being a blocker unless the report lists it as a compromise.
 */
export function readStoryClosing(root: string, asked: string, strict: boolean): StoryClosing {
  const ws = new Workspace(root, false);
  const { config } = readConfig(root);
  const rows = readSlices(ws);

  if (rows === undefined) {
    throw new CliError(
      `${SLICES_FILE} is missing or has no slices table.`,
      'Plan the slices first (the skill ddd-ts-kit:plan-slices writes the table), then run story-check again.',
    );
  }

  const story = asked.replace(/^#/, '');

  if (!rows.some((row) => storyOf(row.id) === story)) {
    throw unknownStory(story, rows);
  }

  const contexts = projectContexts(ws, config);
  const scope = storyScope(story, rows, contexts);
  const candidates = readRemaining(ws, config).filter((marker) => mayKeepOpen(marker, scope));
  const ids = [...new Set(rows.map((row) => row.id))];
  const markers = attributeMarkers(root, candidates, { ids, git: runGit });
  const design = designDepartures({ root, config }, story, rows);

  return closingOf(story, { rows, markers, contexts, design }, strict);
}

function unknownStory(story: string, rows: readonly Slice[]): CliError {
  const known = [...new Set(rows.map((row) => storyOf(row.id)))].filter((code) => code !== undefined);
  const row = rows.find((candidate) => candidate.id === story);
  const ofRow = row === undefined ? '' : `#${story} is a row: its story is ${storyOf(story) ?? 'none'}. `;

  const use =
    known.length > 0
      ? `Use one of: ${known.join(', ')}.`
      : 'Number the rows with the code of their story or milestone (`US5.03`, `M2.07`), as the skill ddd-ts-kit:plan-slices says.';

  return new CliError(
    `No row of ${SLICES_FILE} belongs to the story or milestone "${story}".`,
    `${ofRow}Pass the code the ids of its rows start with (\`M1\` for \`M1.03\`). ${use}`,
  );
}
